import { DeviceMotion } from 'expo-sensors';
import { Point3D } from './Spatial3DService';
import { ARPose, VIOState } from './ARVIOFusionService';

// Expo Go compatible motion/VIO service using only expo-sensors
export class ExpoGoMotionService {
  private config: any;
  private isActive: boolean = false;
  private motionSubscription: any = null;
  
  // VIO state using device motion
  private vioState: VIOState = {
    position: { x: 0, y: 0, z: 0, timestamp: Date.now() },
    velocity: { x: 0, y: 0, z: 0, timestamp: Date.now() },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: { x: 0, y: 0, z: 0, timestamp: Date.now() },
    timestamp: Date.now(),
    confidence: 0.5
  };

  // Motion integration
  private lastUpdate: number = 0;
  private motionBuffer: any[] = [];
  
  constructor(config: any = {}) {
    this.config = {
      onPoseUpdate: config.onPoseUpdate,
      imuUpdateRate: 60,
      ...config
    };
  }

  async startVIOTracking(): Promise<void> {
    if (this.isActive) return;

    try {
      this.isActive = true;
      this.lastUpdate = Date.now();

      // Use DeviceMotion for basic VIO functionality
      await DeviceMotion.setUpdateInterval(1000 / this.config.imuUpdateRate);
      
      this.motionSubscription = DeviceMotion.addListener((data) => {
        this.processMotionData(data);
      });

      console.log('Expo Go VIO tracking started using DeviceMotion');
    } catch (error) {
      this.isActive = false;
      console.error('Error starting Expo Go VIO tracking:', error);
      throw error;
    }
  }

  async stopVIOTracking(): Promise<void> {
    this.isActive = false;

    if (this.motionSubscription) {
      this.motionSubscription.remove();
      this.motionSubscription = null;
    }

    this.resetVIOState();
    this.motionBuffer = [];
  }

  private processMotionData(data: any): void {
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000; // seconds
    
    if (dt <= 0 || dt > 0.1) {
      this.lastUpdate = now;
      return; // Skip invalid time steps
    }

    // Extract motion data
    const acceleration = data.acceleration || { x: 0, y: 0, z: 0 };
    const rotation = data.rotation || { alpha: 0, beta: 0, gamma: 0 };
    
    // Simple motion integration for relative positioning
    this.integrateMotion(acceleration, rotation, dt);
    
    // Update pose
    const pose: ARPose = {
      position: this.vioState.position,
      orientation: this.vioState.orientation,
      confidence: this.vioState.confidence,
      timestamp: now
    };

    this.config.onPoseUpdate?.(pose);
    this.lastUpdate = now;
  }

  private integrateMotion(acceleration: any, rotation: any, dt: number): void {
    // Remove gravity estimate (simplified)
    const gravity = 9.81;
    const linearAccel = {
      x: acceleration.x,
      y: acceleration.y,
      z: acceleration.z + gravity, // Assuming Z-up
      timestamp: Date.now()
    };

    // Dead reckoning integration
    // Update velocity
    this.vioState.velocity.x += linearAccel.x * dt;
    this.vioState.velocity.y += linearAccel.y * dt;
    this.vioState.velocity.z += linearAccel.z * dt;

    // Update position
    this.vioState.position.x += this.vioState.velocity.x * dt;
    this.vioState.position.y += this.vioState.velocity.y * dt;
    this.vioState.position.z += this.vioState.velocity.z * dt;

    // Update orientation from device rotation
    this.vioState.orientation = this.rotationToQuaternion(rotation);
    
    // Update timestamp
    this.vioState.timestamp = Date.now();
    this.vioState.position.timestamp = Date.now();

    // Apply motion damping to prevent drift
    this.vioState.velocity.x *= 0.98;
    this.vioState.velocity.y *= 0.98;
    this.vioState.velocity.z *= 0.98;

    // Confidence decreases over time without external corrections
    this.vioState.confidence = Math.max(0.1, this.vioState.confidence - 0.001);
  }

  private rotationToQuaternion(rotation: any): { x: number, y: number, z: number, w: number } {
    // Convert device rotation to quaternion (simplified)
    const alpha = (rotation.alpha || 0) * Math.PI / 180;
    const beta = (rotation.beta || 0) * Math.PI / 180;
    const gamma = (rotation.gamma || 0) * Math.PI / 180;

    // Simple Euler to quaternion conversion
    const cx = Math.cos(alpha * 0.5);
    const sx = Math.sin(alpha * 0.5);
    const cy = Math.cos(beta * 0.5);
    const sy = Math.sin(beta * 0.5);
    const cz = Math.cos(gamma * 0.5);
    const sz = Math.sin(gamma * 0.5);

    return {
      w: cx * cy * cz + sx * sy * sz,
      x: sx * cy * cz - cx * sy * sz,
      y: cx * sy * cz + sx * cy * sz,
      z: cx * cy * sz - sx * sy * cz
    };
  }

  private resetVIOState(): void {
    this.vioState = {
      position: { x: 0, y: 0, z: 0, timestamp: Date.now() },
      velocity: { x: 0, y: 0, z: 0, timestamp: Date.now() },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocity: { x: 0, y: 0, z: 0, timestamp: Date.now() },
      timestamp: Date.now(),
      confidence: 0.5
    };
  }

  // GNSS fusion for drift correction
  fuseWithGNSS(gnssPosition: any, spatial3DService: any): void {
    if (!this.isActive) return;

    try {
      // Convert GNSS to local coordinates
      const localGNSS = spatial3DService.convertGeoToLocal(gnssPosition);
      
      // Calculate drift and apply correction
      const drift = {
        x: localGNSS.x - this.vioState.position.x,
        y: localGNSS.y - this.vioState.position.y,
        z: localGNSS.z - this.vioState.position.z
      };

      // Apply gradual correction
      const correctionFactor = gnssPosition.accuracy ? 
        Math.min(1.0, 10.0 / gnssPosition.accuracy) : 0.5;
      
      this.vioState.position.x += drift.x * correctionFactor * 0.1;
      this.vioState.position.y += drift.y * correctionFactor * 0.1;
      this.vioState.position.z += drift.z * correctionFactor * 0.1;

      // Boost confidence
      this.vioState.confidence = Math.min(0.9, this.vioState.confidence + 0.1);
      
      console.log(`Expo Go VIO corrected by GNSS: drift = ${Math.sqrt(drift.x*drift.x + drift.y*drift.y).toFixed(2)}m`);
    } catch (error) {
      console.error('Error fusing GNSS with Expo Go VIO:', error);
    }
  }

  getCurrentPose(): ARPose | null {
    return {
      position: this.vioState.position,
      orientation: this.vioState.orientation,
      confidence: this.vioState.confidence,
      timestamp: this.vioState.timestamp
    };
  }

  getCurrentVIOState(): VIOState | null {
    return this.vioState;
  }

  getPositionSource() {
    const timeSinceReset = Date.now() - this.vioState.timestamp;
    let accuracy = 0.5;
    
    // Accuracy degrades over time
    if (timeSinceReset > 60000) {
      accuracy += (timeSinceReset - 60000) / 60000;
    }

    return {
      type: 'vio',
      weight: this.vioState.confidence,
      accuracy: Math.min(accuracy, 10.0),
      timestamp: this.vioState.timestamp
    };
  }

  isTracking(): boolean {
    return this.isActive;
  }
}

export default ExpoGoMotionService;
