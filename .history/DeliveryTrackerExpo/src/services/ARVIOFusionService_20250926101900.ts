import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { DeviceMotion, Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import { Point3D, GeoPoint3D, PositionSource, SpatialPosition } from './Spatial3DService';

// AR/VIO Types
export interface ARPose {
  position: Point3D;
  orientation: Quaternion;
  confidence: number;
  timestamp: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface VisualFeature {
  id: string;
  position: Point3D;
  descriptor: number[];
  lastSeen: number;
  confidence: number;
}

export interface VisualMarker {
  id: string;
  type: 'aruco' | 'april_tag' | 'custom';
  worldPosition: Point3D;
  size: number; // meters
  content?: string;
}

export interface VIOState {
  position: Point3D;
  velocity: Point3D;
  orientation: Quaternion;
  angularVelocity: Point3D;
  timestamp: number;
  confidence: number;
}

export interface IMUReading {
  acceleration: Point3D;
  angularVelocity: Point3D;
  magneticField?: Point3D;
  timestamp: number;
}

export interface ARVIOConfig {
  onPoseUpdate?: (pose: ARPose) => void;
  onVisualMarkerDetected?: (marker: VisualMarker, pose: ARPose) => void;
  onRelocalization?: (newPose: ARPose, confidence: number) => void;
  enableVisualFeatureTracking?: boolean;
  enableIMUFusion?: boolean;
  maxTrackingFeatures?: number;
  imuUpdateRate?: number; // Hz
}

class ARVIOFusionService {
  private config: ARVIOConfig;
  private isActive: boolean = false;
  
  // VIO State
  private currentVIOState: VIOState | null = null;
  private lastResetTime: number = 0;
  
  // IMU data
  private imuSubscriptions: any[] = [];
  private imuBuffer: IMUReading[] = [];
  private lastIMUUpdate: number = 0;
  
  // Visual tracking
  private trackedFeatures: Map<string, VisualFeature> = new Map();
  private knownMarkers: Map<string, VisualMarker> = new Map();
  private currentPose: ARPose | null = null;
  
  // Drift correction
  private lastGNSSCorrection: number = 0;
  private accumulatedDrift: Point3D = { x: 0, y: 0, z: 0, timestamp: 0 };
  
  // Extended Kalman Filter for VIO
  private ekf: ExtendedKalmanFilter;

  constructor(config: ARVIOConfig = {}) {
    this.config = {
      enableVisualFeatureTracking: true,
      enableIMUFusion: true,
      maxTrackingFeatures: 100,
      imuUpdateRate: 60, // 60 Hz
      ...config
    };

    this.ekf = new ExtendedKalmanFilter();
    this.initializeKnownMarkers();
  }

  private initializeKnownMarkers(): void {
    // Initialize with no visual markers - phones act as beacons only
    // Visual features will be tracked but not used for absolute positioning
    console.log('VIO service initialized without visual markers - using phone-based positioning only');
  }

  async startVIOTracking(): Promise<void> {
    if (this.isActive) {
      console.log('AR VIO tracking already active');
      return;
    }

    try {
      this.isActive = true;
      this.lastResetTime = Date.now();

      // Initialize VIO state at origin
      this.currentVIOState = {
        position: { x: 0, y: 0, z: 0, timestamp: Date.now() },
        velocity: { x: 0, y: 0, z: 0, timestamp: Date.now() },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        angularVelocity: { x: 0, y: 0, z: 0, timestamp: Date.now() },
        timestamp: Date.now(),
        confidence: 0.5
      };

      // Start IMU monitoring if enabled
      if (this.config.enableIMUFusion) {
        await this.startIMUMonitoring();
      }

      // Initialize visual tracking for features only (no marker detection)
      if (this.config.enableVisualFeatureTracking) {
        this.initializeVisualTracking();
      }

      // Reset EKF
      this.ekf.reset();

      console.log('AR VIO tracking started');
    } catch (error) {
      this.isActive = false;
      console.error('Error starting AR VIO tracking:', error);
      throw error;
    }
  }

  async stopVIOTracking(): Promise<void> {
    this.isActive = false;

    // Stop IMU monitoring
    this.imuSubscriptions.forEach(subscription => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    });
    this.imuSubscriptions = [];

    // Clear state
    this.currentVIOState = null;
    this.currentPose = null;
    this.trackedFeatures.clear();
    this.imuBuffer = [];

    console.log('AR VIO tracking stopped');
  }

  private async startIMUMonitoring(): Promise<void> {
    const updateInterval = 1000 / this.config.imuUpdateRate!; // Convert Hz to ms

    // Accelerometer
    await Accelerometer.setUpdateInterval(updateInterval);
    const accelSub = Accelerometer.addListener((data) => {
      this.processIMUData({
        acceleration: { x: data.x, y: data.y, z: data.z, timestamp: Date.now() },
        angularVelocity: { x: 0, y: 0, z: 0, timestamp: Date.now() },
        timestamp: Date.now()
      });
    });
    this.imuSubscriptions.push(accelSub);

    // Gyroscope
    await Gyroscope.setUpdateInterval(updateInterval);
    const gyroSub = Gyroscope.addListener((data) => {
      this.processIMUData({
        acceleration: { x: 0, y: 0, z: 0, timestamp: Date.now() },
        angularVelocity: { x: data.x, y: data.y, z: data.z, timestamp: Date.now() },
        timestamp: Date.now()
      });
    });
    this.imuSubscriptions.push(gyroSub);

    // Magnetometer (if available)
    if (Platform.OS === 'ios') {
      await Magnetometer.setUpdateInterval(updateInterval * 2); // Lower rate for magnetometer
      const magSub = Magnetometer.addListener((data) => {
        this.processIMUData({
          acceleration: { x: 0, y: 0, z: 0, timestamp: Date.now() },
          angularVelocity: { x: 0, y: 0, z: 0, timestamp: Date.now() },
          magneticField: { x: data.x, y: data.y, z: data.z, timestamp: Date.now() },
          timestamp: Date.now()
        });
      });
      this.imuSubscriptions.push(magSub);
    }
  }

  private processIMUData(reading: IMUReading): void {
    // Add to buffer
    this.imuBuffer.push(reading);
    if (this.imuBuffer.length > 60) { // Keep last 1 second at 60Hz
      this.imuBuffer.shift();
    }

    const now = Date.now();
    if (now - this.lastIMUUpdate < 16) { // Limit updates to ~60Hz
      return;
    }
    this.lastIMUUpdate = now;

    // Integrate IMU data for dead reckoning
    this.integrateIMUData(reading);
  }

  private integrateIMUData(reading: IMUReading): void {
    if (!this.currentVIOState) return;

    const dt = (reading.timestamp - this.currentVIOState.timestamp) / 1000; // seconds
    if (dt <= 0 || dt > 0.1) return; // Skip invalid or too large time steps

    // Simple integration (in a real implementation, this would be much more sophisticated)
    const gravity = { x: 0, y: 0, z: -9.81 }; // Assume Z-up coordinate system
    
    // Remove gravity estimate (simplified)
    const linearAccel = {
      x: reading.acceleration.x - gravity.x,
      y: reading.acceleration.y - gravity.y,
      z: reading.acceleration.z - gravity.z,
      timestamp: reading.timestamp
    };

    // Update velocity
    const newVelocity = {
      x: this.currentVIOState.velocity.x + linearAccel.x * dt,
      y: this.currentVIOState.velocity.y + linearAccel.y * dt,
      z: this.currentVIOState.velocity.z + linearAccel.z * dt,
      timestamp: reading.timestamp
    };

    // Update position
    const newPosition = {
      x: this.currentVIOState.position.x + this.currentVIOState.velocity.x * dt + 0.5 * linearAccel.x * dt * dt,
      y: this.currentVIOState.position.y + this.currentVIOState.velocity.y * dt + 0.5 * linearAccel.y * dt * dt,
      z: this.currentVIOState.position.z + this.currentVIOState.velocity.z * dt + 0.5 * linearAccel.z * dt * dt,
      timestamp: reading.timestamp
    };

    // Update orientation (simplified integration)
    const newOrientation = this.integrateAngularVelocity(
      this.currentVIOState.orientation,
      reading.angularVelocity,
      dt
    );

    // Update VIO state
    this.currentVIOState = {
      position: newPosition,
      velocity: newVelocity,
      orientation: newOrientation,
      angularVelocity: reading.angularVelocity,
      timestamp: reading.timestamp,
      confidence: Math.max(0.1, this.currentVIOState.confidence - 0.001) // Slowly decrease confidence
    };

    // Create AR pose
    const pose: ARPose = {
      position: newPosition,
      orientation: newOrientation,
      confidence: this.currentVIOState.confidence,
      timestamp: reading.timestamp
    };

    this.currentPose = pose;
    this.config.onPoseUpdate?.(pose);
  }

  private integrateAngularVelocity(orientation: Quaternion, angularVel: Point3D, dt: number): Quaternion {
    // Convert angular velocity to quaternion
    const angle = Math.sqrt(angularVel.x * angularVel.x + angularVel.y * angularVel.y + angularVel.z * angularVel.z);
    if (angle < 1e-6) return orientation; // No rotation

    const s = Math.sin(angle * dt * 0.5) / angle;
    const deltaQ = {
      x: angularVel.x * s,
      y: angularVel.y * s,
      z: angularVel.z * s,
      w: Math.cos(angle * dt * 0.5)
    };

    // Multiply quaternions: result = orientation * deltaQ
    return {
      x: orientation.w * deltaQ.x + orientation.x * deltaQ.w + orientation.y * deltaQ.z - orientation.z * deltaQ.y,
      y: orientation.w * deltaQ.y - orientation.x * deltaQ.z + orientation.y * deltaQ.w + orientation.z * deltaQ.x,
      z: orientation.w * deltaQ.z + orientation.x * deltaQ.y - orientation.y * deltaQ.x + orientation.z * deltaQ.w,
      w: orientation.w * deltaQ.w - orientation.x * deltaQ.x - orientation.y * deltaQ.y - orientation.z * deltaQ.z
    };
  }

  private initializeVisualTracking(): void {
    // In a real implementation, this would initialize camera and computer vision
    // for visual feature tracking only (no marker detection)
    console.log('Visual feature tracking initialized (no marker detection)');
  }

  private simulateMarkerDetection(): void {
    if (!this.currentPose || !this.isActive) return;

    // Simulate detecting a nearby marker
    const nearbyMarkers = Array.from(this.knownMarkers.values()).filter(marker => {
      const distance = this.calculateDistance3D(this.currentPose!.position, marker.worldPosition);
      return distance < 5.0; // Within 5 meters
    });

    if (nearbyMarkers.length > 0) {
      const marker = nearbyMarkers[0];
      console.log(`Simulated detection of marker: ${marker.id}`);
      
      // Trigger relocalization
      this.relocateFromMarker(marker);
      
      this.config.onVisualMarkerDetected?.(marker, this.currentPose);
    }
  }

  private relocateFromMarker(marker: VisualMarker): void {
    if (!this.currentPose) return;

    // Calculate correction based on marker position
    const expectedDistance = 2.0; // Assume we detected marker at 2 meters
    const correctedPosition = {
      x: marker.worldPosition.x + (Math.random() - 0.5) * 0.1, // Add small noise
      y: marker.worldPosition.y + expectedDistance,
      z: marker.worldPosition.z,
      timestamp: Date.now()
    };

    // Update VIO state with high confidence
    if (this.currentVIOState) {
      this.currentVIOState.position = correctedPosition;
      this.currentVIOState.confidence = 0.95; // High confidence after relocalization
      this.currentVIOState.timestamp = Date.now();
    }

    // Create corrected pose
    const correctedPose: ARPose = {
      position: correctedPosition,
      orientation: this.currentPose.orientation,
      confidence: 0.95,
      timestamp: Date.now()
    };

    this.currentPose = correctedPose;
    this.config.onRelocalization?.(correctedPose, 0.95);
    
    console.log(`Relocalized to marker ${marker.id} with high confidence`);
  }

  // GNSS-VIO fusion
  fuseWithGNSS(gnssPosition: GeoPoint3D, spatial3DService: any): void {
    if (!this.currentVIOState || !this.isActive) return;

    try {
      // Convert GNSS to local coordinates
      const localGNSS = spatial3DService.convertGeoToLocal(gnssPosition);
      
      // Calculate drift
      const drift = {
        x: localGNSS.x - this.currentVIOState.position.x,
        y: localGNSS.y - this.currentVIOState.position.y,
        z: localGNSS.z - this.currentVIOState.position.z,
        timestamp: Date.now()
      };

      // Apply drift correction gradually
      const correctionFactor = gnssPosition.accuracy ? Math.min(1.0, 10.0 / gnssPosition.accuracy) : 0.5;
      
      this.currentVIOState.position.x += drift.x * correctionFactor * 0.1; // 10% correction per update
      this.currentVIOState.position.y += drift.y * correctionFactor * 0.1;
      this.currentVIOState.position.z += drift.z * correctionFactor * 0.1;

      // Boost confidence
      this.currentVIOState.confidence = Math.min(0.9, this.currentVIOState.confidence + 0.1);
      
      this.lastGNSSCorrection = Date.now();
      
      console.log(`VIO corrected by GNSS: drift = ${Math.sqrt(drift.x*drift.x + drift.y*drift.y).toFixed(2)}m`);
    } catch (error) {
      console.error('Error fusing GNSS with VIO:', error);
    }
  }

  getCurrentPose(): ARPose | null {
    return this.currentPose;
  }

  getCurrentVIOState(): VIOState | null {
    return this.currentVIOState;
  }

  getTrackedFeatures(): VisualFeature[] {
    return Array.from(this.trackedFeatures.values());
  }

  getKnownMarkers(): VisualMarker[] {
    return Array.from(this.knownMarkers.values());
  }

  // Get position source for fusion
  getPositionSource(): PositionSource {
    const confidence = this.currentVIOState?.confidence || 0;
    const timeSinceReset = Date.now() - this.lastResetTime;
    const timeSinceGNSS = Date.now() - this.lastGNSSCorrection;

    // Accuracy degrades over time without external corrections
    let accuracy = 0.5; // Base accuracy
    if (timeSinceReset > 60000) accuracy += (timeSinceReset - 60000) / 60000; // Degrade after 1 minute
    if (timeSinceGNSS > 30000) accuracy += (timeSinceGNSS - 30000) / 30000; // Degrade without GNSS

    return {
      type: 'vio',
      weight: confidence,
      accuracy: Math.min(accuracy, 10.0), // Cap at 10m accuracy
      timestamp: this.currentVIOState?.timestamp || Date.now()
    };
  }

  private calculateDistance3D(point1: Point3D, point2: Point3D): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  isTracking(): boolean {
    return this.isActive;
  }
}

// Simple Extended Kalman Filter for VIO
class ExtendedKalmanFilter {
  private state: number[] = []; // [x, y, z, vx, vy, vz, qx, qy, qz, qw]
  private covariance: number[][] = [];
  private processNoise: number = 0.01;
  private measurementNoise: number = 0.1;

  constructor() {
    this.reset();
  }

  reset(): void {
    // Initialize state [position, velocity, quaternion]
    this.state = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    
    // Initialize covariance matrix
    this.covariance = Array(10).fill(0).map(() => Array(10).fill(0));
    for (let i = 0; i < 10; i++) {
      this.covariance[i][i] = 1.0; // Identity matrix
    }
  }

  predict(dt: number, acceleration: Point3D, angularVelocity: Point3D): void {
    // Simplified prediction step
    // In a real implementation, this would be much more sophisticated
    
    // Update position and velocity
    this.state[0] += this.state[3] * dt + 0.5 * acceleration.x * dt * dt;
    this.state[1] += this.state[4] * dt + 0.5 * acceleration.y * dt * dt;
    this.state[2] += this.state[5] * dt + 0.5 * acceleration.z * dt * dt;
    
    this.state[3] += acceleration.x * dt;
    this.state[4] += acceleration.y * dt;
    this.state[5] += acceleration.z * dt;

    // Add process noise to covariance
    for (let i = 0; i < 10; i++) {
      this.covariance[i][i] += this.processNoise;
    }
  }

  update(measurement: Point3D): void {
    // Simplified update step
    // Measurement is just position
    
    const innovation = [
      measurement.x - this.state[0],
      measurement.y - this.state[1],
      measurement.z - this.state[2]
    ];

    // Kalman gain (simplified)
    const gain = this.covariance[0][0] / (this.covariance[0][0] + this.measurementNoise);

    // Update state
    this.state[0] += gain * innovation[0];
    this.state[1] += gain * innovation[1];
    this.state[2] += gain * innovation[2];

    // Update covariance
    for (let i = 0; i < 3; i++) {
      this.covariance[i][i] *= (1 - gain);
    }
  }

  getState(): number[] {
    return [...this.state];
  }
}

export default ARVIOFusionService;
