import * as Location from 'expo-location';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import { Point3D, UserPosition3D, BeaconAnchor, UWBAnchor } from './Venue3DMapService';

// Enhanced AR/VIO Fusion Service with BLE/UWB Integration
export interface VIOState {
  position: Point3D;
  orientation: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  velocity: Point3D;
  confidence: number;
  timestamp: number;
  isTracking: boolean;
}

export interface BeaconReading {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  distance: number;
  accuracy: number;
  timestamp: number;
}

export interface UWBReading {
  anchorId: string;
  distance: number;
  angle?: number;
  accuracy: number;
  timestamp: number;
}

export interface ARFeature {
  id: string;
  position: Point3D;
  descriptor: number[];
  confidence: number;
  lastSeen: number;
  trackingQuality: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface FusedPosition {
  position: Point3D;
  orientation: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  accuracy: number;
  floor: number;
  zoneId?: string;
  confidence: number;
  timestamp: number;
  sources: {
    vio: number;      // 0-1 weight
    beacon: number;   // 0-1 weight
    uwb: number;      // 0-1 weight
    gps: number;      // 0-1 weight
  };
  quality: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface CalibrationData {
  magneticDeclination: number;
  gravityVector: Point3D;
  magneticField: Point3D;
  beaconCalibration: Map<string, { txPower: number; pathLoss: number }>;
  uwbCalibration: Map<string, { offset: Point3D; accuracy: number }>;
}

class EnhancedARVIOService {
  private static instance: EnhancedARVIOService;
  private isInitialized: boolean = false;
  private isTracking: boolean = false;
  
  // Sensor subscriptions
  private accelerometerSubscription: any = null;
  private gyroscopeSubscription: any = null;
  private magnetometerSubscription: any = null;
  
  // VIO state
  private vioState: VIOState = {
    position: { x: 0, y: 0, z: 0 },
    orientation: { pitch: 0, yaw: 0, roll: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    confidence: 0,
    timestamp: 0,
    isTracking: false
  };
  
  // Sensor data buffers
  private accelBuffer: { x: number; y: number; z: number; timestamp: number }[] = [];
  private gyroBuffer: { x: number; y: number; z: number; timestamp: number }[] = [];
  private magnetBuffer: { x: number; y: number; z: number; timestamp: number }[] = [];
  
  // AR features and tracking
  private arFeatures: Map<string, ARFeature> = new Map();
  private featureIdCounter: number = 0;
  
  // Beacon and UWB data
  private recentBeacons: Map<string, BeaconReading> = new Map();
  private recentUWB: Map<string, UWBReading> = new Map();
  
  // Calibration and configuration
  private calibrationData: CalibrationData = {
    magneticDeclination: 0,
    gravityVector: { x: 0, y: 0, z: -9.81 },
    magneticField: { x: 0, y: 0, z: 0 },
    beaconCalibration: new Map(),
    uwbCalibration: new Map()
  };
  
  // Fusion parameters
  private fusionWeights = {
    vio: 0.4,
    beacon: 0.3,
    uwb: 0.2,
    gps: 0.1
  };
  
  private lastFusedPosition: FusedPosition | null = null;
  private positionUpdateCallback: ((position: FusedPosition) => void) | null = null;

  static getInstance(): EnhancedARVIOService {
    if (!EnhancedARVIOService.instance) {
      EnhancedARVIOService.instance = new EnhancedARVIOService();
    }
    return EnhancedARVIOService.instance;
  }

  // === INITIALIZATION ===

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('Initializing Enhanced AR/VIO Service...');

      // Request sensor permissions
      const accelStatus = await Accelerometer.requestPermissionsAsync();
      const gyroStatus = await Gyroscope.requestPermissionsAsync();
      const magnetStatus = await Magnetometer.requestPermissionsAsync();

      if (accelStatus.status !== 'granted' || 
          gyroStatus.status !== 'granted' || 
          magnetStatus.status !== 'granted') {
        console.error('Sensor permissions denied');
        return false;
      }

      // Initialize sensor update intervals
      Accelerometer.setUpdateInterval(50); // 20Hz
      Gyroscope.setUpdateInterval(50);     // 20Hz
      Magnetometer.setUpdateInterval(100); // 10Hz

      // Perform initial calibration
      await this.performInitialCalibration();

      this.isInitialized = true;
      console.log('Enhanced AR/VIO Service initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize AR/VIO service:', error);
      return false;
    }
  }

  private async performInitialCalibration(): Promise<void> {
    console.log('Performing initial sensor calibration...');
    
    // Collect calibration data for 3 seconds
    const calibrationPromise = new Promise<void>((resolve) => {
      const accelReadings: Point3D[] = [];
      const magnetReadings: Point3D[] = [];
      let sampleCount = 0;
      const targetSamples = 60; // 3 seconds at 20Hz

      const accelSub = Accelerometer.addListener(({ x, y, z }) => {
        accelReadings.push({ x, y, z });
        sampleCount++;
        
        if (sampleCount >= targetSamples) {
          accelSub.remove();
          
          // Calculate gravity vector (average of stationary readings)
          const avgAccel = accelReadings.reduce(
            (sum, reading) => ({
              x: sum.x + reading.x,
              y: sum.y + reading.y,
              z: sum.z + reading.z
            }),
            { x: 0, y: 0, z: 0 }
          );
          
          this.calibrationData.gravityVector = {
            x: avgAccel.x / accelReadings.length,
            y: avgAccel.y / accelReadings.length,
            z: avgAccel.z / accelReadings.length
          };
          
          resolve();
        }
      });

      const magnetSub = Magnetometer.addListener(({ x, y, z }) => {
        magnetReadings.push({ x, y, z });
      });

      // Clean up magnetometer after calibration
      setTimeout(() => {
        magnetSub.remove();
        
        if (magnetReadings.length > 0) {
          const avgMagnetic = magnetReadings.reduce(
            (sum, reading) => ({
              x: sum.x + reading.x,
              y: sum.y + reading.y,
              z: sum.z + reading.z
            }),
            { x: 0, y: 0, z: 0 }
          );
          
          this.calibrationData.magneticField = {
            x: avgMagnetic.x / magnetReadings.length,
            y: avgMagnetic.y / magnetReadings.length,
            z: avgMagnetic.z / magnetReadings.length
          };
        }
      }, 3000);
    });

    await calibrationPromise;
    console.log('Sensor calibration completed');
  }

  // === TRACKING CONTROL ===

  async startTracking(): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('Service not initialized');
      return false;
    }

    if (this.isTracking) return true;

    try {
      // Start sensor subscriptions
      this.accelerometerSubscription = Accelerometer.addListener(this.handleAccelerometerData.bind(this));
      this.gyroscopeSubscription = Gyroscope.addListener(this.handleGyroscopeData.bind(this));
      this.magnetometerSubscription = Magnetometer.addListener(this.handleMagnetometerData.bind(this));

      this.isTracking = true;
      this.vioState.isTracking = true;
      
      // Start fusion loop
      this.startFusionLoop();
      
      console.log('AR/VIO tracking started');
      return true;

    } catch (error) {
      console.error('Failed to start tracking:', error);
      return false;
    }
  }

  stopTracking(): void {
    if (!this.isTracking) return;

    // Stop sensor subscriptions
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }
    if (this.gyroscopeSubscription) {
      this.gyroscopeSubscription.remove();
      this.gyroscopeSubscription = null;
    }
    if (this.magnetometerSubscription) {
      this.magnetometerSubscription.remove();
      this.magnetometerSubscription = null;
    }

    this.isTracking = false;
    this.vioState.isTracking = false;
    
    console.log('AR/VIO tracking stopped');
  }

  // === SENSOR DATA PROCESSING ===

  private handleAccelerometerData(data: { x: number; y: number; z: number }): void {
    const timestamp = Date.now();
    
    // Add to buffer
    this.accelBuffer.push({ ...data, timestamp });
    
    // Keep buffer size manageable (last 2 seconds)
    const cutoffTime = timestamp - 2000;
    this.accelBuffer = this.accelBuffer.filter(reading => reading.timestamp > cutoffTime);
    
    // Process for VIO
    this.updateVIOFromAccelerometer(data, timestamp);
  }

  private handleGyroscopeData(data: { x: number; y: number; z: number }): void {
    const timestamp = Date.now();
    
    // Add to buffer
    this.gyroBuffer.push({ ...data, timestamp });
    
    // Keep buffer size manageable
    const cutoffTime = timestamp - 2000;
    this.gyroBuffer = this.gyroBuffer.filter(reading => reading.timestamp > cutoffTime);
    
    // Process for VIO
    this.updateVIOFromGyroscope(data, timestamp);
  }

  private handleMagnetometerData(data: { x: number; y: number; z: number }): void {
    const timestamp = Date.now();
    
    // Add to buffer
    this.magnetBuffer.push({ ...data, timestamp });
    
    // Keep buffer size manageable
    const cutoffTime = timestamp - 5000;
    this.magnetBuffer = this.magnetBuffer.filter(reading => reading.timestamp > cutoffTime);
    
    // Update orientation
    this.updateOrientationFromMagnetometer(data, timestamp);
  }

  private updateVIOFromAccelerometer(data: { x: number; y: number; z: number }, timestamp: number): void {
    // Remove gravity component
    const linearAccel = {
      x: data.x - this.calibrationData.gravityVector.x,
      y: data.y - this.calibrationData.gravityVector.y,
      z: data.z - this.calibrationData.gravityVector.z
    };

    // Simple integration for velocity (in practice, use more sophisticated algorithms)
    const dt = this.vioState.timestamp > 0 ? (timestamp - this.vioState.timestamp) / 1000 : 0;
    
    if (dt > 0 && dt < 0.1) { // Reasonable time delta
      this.vioState.velocity.x += linearAccel.x * dt;
      this.vioState.velocity.y += linearAccel.y * dt;
      this.vioState.velocity.z += linearAccel.z * dt;
      
      // Apply damping to prevent drift
      this.vioState.velocity.x *= 0.95;
      this.vioState.velocity.y *= 0.95;
      this.vioState.velocity.z *= 0.95;
      
      // Update position
      this.vioState.position.x += this.vioState.velocity.x * dt;
      this.vioState.position.y += this.vioState.velocity.y * dt;
      this.vioState.position.z += this.vioState.velocity.z * dt;
    }

    this.vioState.timestamp = timestamp;
  }

  private updateVIOFromGyroscope(data: { x: number; y: number; z: number }, timestamp: number): void {
    const dt = this.vioState.timestamp > 0 ? (timestamp - this.vioState.timestamp) / 1000 : 0;
    
    if (dt > 0 && dt < 0.1) {
      // Convert rad/s to degrees and integrate
      this.vioState.orientation.pitch += (data.x * 180 / Math.PI) * dt;
      this.vioState.orientation.yaw += (data.y * 180 / Math.PI) * dt;
      this.vioState.orientation.roll += (data.z * 180 / Math.PI) * dt;
      
      // Keep angles in reasonable range
      this.vioState.orientation.pitch = this.normalizeAngle(this.vioState.orientation.pitch);
      this.vioState.orientation.yaw = this.normalizeAngle(this.vioState.orientation.yaw);
      this.vioState.orientation.roll = this.normalizeAngle(this.vioState.orientation.roll);
    }
  }

  private updateOrientationFromMagnetometer(data: { x: number; y: number; z: number }, timestamp: number): void {
    // Calculate magnetic heading
    const heading = Math.atan2(data.y, data.x) * 180 / Math.PI;
    const correctedHeading = this.normalizeAngle(heading + this.calibrationData.magneticDeclination);
    
    // Smooth integration with gyroscope yaw
    const alpha = 0.1; // Low-pass filter coefficient
    this.vioState.orientation.yaw = this.vioState.orientation.yaw * (1 - alpha) + correctedHeading * alpha;
  }

  private normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  // === BEACON INTEGRATION ===

  updateBeaconReading(reading: BeaconReading): void {
    this.recentBeacons.set(reading.uuid, reading);
    
    // Clean up old readings (older than 10 seconds)
    const cutoffTime = Date.now() - 10000;
    for (const [uuid, beacon] of this.recentBeacons.entries()) {
      if (beacon.timestamp < cutoffTime) {
        this.recentBeacons.delete(uuid);
      }
    }
  }

  // === UWB INTEGRATION ===

  updateUWBReading(reading: UWBReading): void {
    this.recentUWB.set(reading.anchorId, reading);
    
    // Clean up old readings
    const cutoffTime = Date.now() - 5000;
    for (const [anchorId, uwb] of this.recentUWB.entries()) {
      if (uwb.timestamp < cutoffTime) {
        this.recentUWB.delete(anchorId);
      }
    }
  }

  // === POSITION FUSION ===

  private startFusionLoop(): void {
    const fusionInterval = setInterval(() => {
      if (!this.isTracking) {
        clearInterval(fusionInterval);
        return;
      }
      
      const fusedPosition = this.computeFusedPosition();
      if (fusedPosition) {
        this.lastFusedPosition = fusedPosition;
        
        if (this.positionUpdateCallback) {
          this.positionUpdateCallback(fusedPosition);
        }
      }
    }, 100); // 10Hz fusion rate
  }

  private computeFusedPosition(): FusedPosition | null {
    const timestamp = Date.now();
    
    // Get position estimates from different sources
    const vioPosition = this.getVIOPosition();
    const beaconPosition = this.getBeaconTriangulatedPosition();
    const uwbPosition = this.getUWBTriangulatedPosition();
    
    // Calculate weights based on confidence and availability
    const weights = this.calculateFusionWeights(vioPosition, beaconPosition, uwbPosition);
    
    if (weights.total === 0) return null;
    
    // Weighted fusion
    const fusedPos: Point3D = {
      x: 0, y: 0, z: 0
    };
    
    if (vioPosition && weights.vio > 0) {
      fusedPos.x += vioPosition.x * weights.vio;
      fusedPos.y += vioPosition.y * weights.vio;
      fusedPos.z += vioPosition.z * weights.vio;
    }
    
    if (beaconPosition && weights.beacon > 0) {
      fusedPos.x += beaconPosition.position.x * weights.beacon;
      fusedPos.y += beaconPosition.position.y * weights.beacon;
      fusedPos.z += beaconPosition.position.z * weights.beacon;
    }
    
    if (uwbPosition && weights.uwb > 0) {
      fusedPos.x += uwbPosition.position.x * weights.uwb;
      fusedPos.y += uwbPosition.position.y * weights.uwb;
      fusedPos.z += uwbPosition.position.z * weights.uwb;
    }

    // Calculate overall accuracy and confidence
    const accuracy = this.calculateFusedAccuracy(weights, beaconPosition, uwbPosition);
    const confidence = Math.min(1.0, weights.total);
    
    // Determine quality
    const quality = this.assessPositionQuality(confidence, accuracy);

    return {
      position: fusedPos,
      orientation: { ...this.vioState.orientation },
      accuracy,
      floor: Math.round(fusedPos.z / 3.5), // Estimate floor from Z coordinate
      confidence,
      timestamp,
      sources: {
        vio: weights.vio,
        beacon: weights.beacon,
        uwb: weights.uwb,
        gps: 0 // Not used indoors
      },
      quality
    };
  }

  private getVIOPosition(): Point3D | null {
    if (!this.vioState.isTracking || this.vioState.confidence < 0.3) {
      return null;
    }
    return { ...this.vioState.position };
  }

  private getBeaconTriangulatedPosition(): { position: Point3D; accuracy: number } | null {
    const activeBeacons = Array.from(this.recentBeacons.values())
      .filter(beacon => beacon.timestamp > Date.now() - 5000)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4); // Use best 4 beacons

    if (activeBeacons.length < 3) return null;

    // Simple trilateration (in practice, use more sophisticated algorithms)
    // This is a simplified implementation
    const position = this.performBeaconTrilateration(activeBeacons);
    const accuracy = this.calculateBeaconAccuracy(activeBeacons);

    return position ? { position, accuracy } : null;
  }

  private getUWBTriangulatedPosition(): { position: Point3D; accuracy: number } | null {
    const activeUWB = Array.from(this.recentUWB.values())
      .filter(uwb => uwb.timestamp > Date.now() - 2000)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 4);

    if (activeUWB.length < 3) return null;

    const position = this.performUWBTrilateration(activeUWB);
    const accuracy = activeUWB.reduce((sum, uwb) => sum + uwb.accuracy, 0) / activeUWB.length;

    return position ? { position, accuracy } : null;
  }

  private performBeaconTrilateration(beacons: BeaconReading[]): Point3D | null {
    // Simplified trilateration - in practice, use proper algorithms like least squares
    if (beacons.length < 3) return null;

    // This is a placeholder implementation
    // Real trilateration would solve the system of equations
    return {
      x: 0, // Calculate from beacon positions and distances
      y: 0,
      z: 0
    };
  }

  private performUWBTrilateration(uwbReadings: UWBReading[]): Point3D | null {
    // Similar to beacon trilateration but with higher precision
    if (uwbReadings.length < 3) return null;

    // Placeholder implementation
    return {
      x: 0,
      y: 0,
      z: 0
    };
  }

  private calculateFusionWeights(
    vioPos: Point3D | null,
    beaconPos: { position: Point3D; accuracy: number } | null,
    uwbPos: { position: Point3D; accuracy: number } | null
  ): { vio: number; beacon: number; uwb: number; total: number } {
    let vioWeight = 0;
    let beaconWeight = 0;
    let uwbWeight = 0;

    // VIO weight based on confidence and tracking quality
    if (vioPos && this.vioState.confidence > 0.3) {
      vioWeight = this.fusionWeights.vio * this.vioState.confidence;
    }

    // Beacon weight based on accuracy and number of beacons
    if (beaconPos) {
      const beaconCount = this.recentBeacons.size;
      const accuracyFactor = Math.max(0.1, 1.0 - (beaconPos.accuracy / 10.0));
      const countFactor = Math.min(1.0, beaconCount / 3.0);
      beaconWeight = this.fusionWeights.beacon * accuracyFactor * countFactor;
    }

    // UWB weight based on accuracy (UWB is typically most accurate)
    if (uwbPos) {
      const uwbCount = this.recentUWB.size;
      const accuracyFactor = Math.max(0.2, 1.0 - (uwbPos.accuracy / 2.0));
      const countFactor = Math.min(1.0, uwbCount / 3.0);
      uwbWeight = this.fusionWeights.uwb * accuracyFactor * countFactor;
    }

    const total = vioWeight + beaconWeight + uwbWeight;

    // Normalize weights
    if (total > 0) {
      return {
        vio: vioWeight / total,
        beacon: beaconWeight / total,
        uwb: uwbWeight / total,
        total: Math.min(1.0, total)
      };
    }

    return { vio: 0, beacon: 0, uwb: 0, total: 0 };
  }

  private calculateFusedAccuracy(
    weights: { vio: number; beacon: number; uwb: number },
    beaconPos: { position: Point3D; accuracy: number } | null,
    uwbPos: { position: Point3D; accuracy: number } | null
  ): number {
    let weightedAccuracy = 0;
    let totalWeight = 0;

    // VIO accuracy (estimated)
    if (weights.vio > 0) {
      const vioAccuracy = 2.0 / this.vioState.confidence; // Rough estimate
      weightedAccuracy += vioAccuracy * weights.vio;
      totalWeight += weights.vio;
    }

    // Beacon accuracy
    if (weights.beacon > 0 && beaconPos) {
      weightedAccuracy += beaconPos.accuracy * weights.beacon;
      totalWeight += weights.beacon;
    }

    // UWB accuracy
    if (weights.uwb > 0 && uwbPos) {
      weightedAccuracy += uwbPos.accuracy * weights.uwb;
      totalWeight += weights.uwb;
    }

    return totalWeight > 0 ? weightedAccuracy / totalWeight : 10.0;
  }

  private calculateBeaconAccuracy(beacons: BeaconReading[]): number {
    // Estimate accuracy based on RSSI variance and number of beacons
    const avgRSSI = beacons.reduce((sum, b) => sum + b.rssi, 0) / beacons.length;
    const rssiVariance = beacons.reduce((sum, b) => sum + Math.pow(b.rssi - avgRSSI, 2), 0) / beacons.length;
    
    // More beacons and lower variance = better accuracy
    const baseAccuracy = 3.0; // meters
    const variancePenalty = Math.sqrt(rssiVariance) * 0.1;
    const countBonus = Math.max(0, (beacons.length - 3) * 0.5);
    
    return Math.max(1.0, baseAccuracy + variancePenalty - countBonus);
  }

  private assessPositionQuality(confidence: number, accuracy: number): 'poor' | 'fair' | 'good' | 'excellent' {
    if (confidence > 0.8 && accuracy < 1.0) return 'excellent';
    if (confidence > 0.6 && accuracy < 2.0) return 'good';
    if (confidence > 0.4 && accuracy < 4.0) return 'fair';
    return 'poor';
  }

  // === PUBLIC API ===

  setPositionUpdateCallback(callback: (position: FusedPosition) => void): void {
    this.positionUpdateCallback = callback;
  }

  getCurrentPosition(): FusedPosition | null {
    return this.lastFusedPosition;
  }

  getVIOState(): VIOState {
    return { ...this.vioState };
  }

  resetVIOState(): void {
    this.vioState = {
      position: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      confidence: 0,
      timestamp: 0,
      isTracking: this.isTracking
    };
    
    console.log('VIO state reset');
  }

  calibrateBeacon(uuid: string, txPower: number, pathLoss: number): void {
    this.calibrationData.beaconCalibration.set(uuid, { txPower, pathLoss });
    console.log(`Beacon ${uuid} calibrated`);
  }

  calibrateUWBAnchor(anchorId: string, offset: Point3D, accuracy: number): void {
    this.calibrationData.uwbCalibration.set(anchorId, { offset, accuracy });
    console.log(`UWB anchor ${anchorId} calibrated`);
  }

  setFusionWeights(weights: { vio: number; beacon: number; uwb: number; gps: number }): void {
    // Normalize weights
    const total = weights.vio + weights.beacon + weights.uwb + weights.gps;
    if (total > 0) {
      this.fusionWeights = {
        vio: weights.vio / total,
        beacon: weights.beacon / total,
        uwb: weights.uwb / total,
        gps: weights.gps / total
      };
      console.log('Fusion weights updated:', this.fusionWeights);
    }
  }

  getTrackingQuality(): 'poor' | 'fair' | 'good' | 'excellent' {
    if (!this.lastFusedPosition) return 'poor';
    return this.lastFusedPosition.quality;
  }

  // === AR FEATURE TRACKING ===

  addARFeature(position: Point3D, descriptor: number[]): string {
    const featureId = `feature_${this.featureIdCounter++}`;
    const feature: ARFeature = {
      id: featureId,
      position: { ...position },
      descriptor: [...descriptor],
      confidence: 1.0,
      lastSeen: Date.now(),
      trackingQuality: 'good'
    };
    
    this.arFeatures.set(featureId, feature);
    return featureId;
  }

  updateARFeature(featureId: string, position: Point3D, confidence: number): boolean {
    const feature = this.arFeatures.get(featureId);
    if (!feature) return false;
    
    feature.position = { ...position };
    feature.confidence = confidence;
    feature.lastSeen = Date.now();
    
    return true;
  }

  getARFeatures(): ARFeature[] {
    // Clean up old features
    const cutoffTime = Date.now() - 30000; // 30 seconds
    Array.from(this.arFeatures.entries()).forEach(([id, feature]) => {
      if (feature.lastSeen < cutoffTime) {
        this.arFeatures.delete(id);
      }
    });
    
    return Array.from(this.arFeatures.values());
  }
}

export default EnhancedARVIOService;
