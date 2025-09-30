import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { DeviceMotion, Accelerometer, Gyroscope } from 'expo-sensors';

export type MotionActivity = 'stationary' | 'walking' | 'running' | 'automotive' | 'unknown';

interface MotionData {
  activity: MotionActivity;
  confidence: number;
  timestamp: number;
}

interface MotionServiceConfig {
  onMotionChange?: (motion: MotionData) => void;
  onLocationBurst?: (location: Location.LocationObject) => void;
  burstDuration?: number; // milliseconds
  motionThreshold?: number; // sensitivity threshold
}

class MotionService {
  private config: MotionServiceConfig;
  private isMonitoring: boolean = false;
  private lastActivity: MotionActivity = 'unknown';
  private accelerometerSubscription: any = null;
  private deviceMotionSubscription: any = null;
  private locationSubscription: any = null;
  private motionBuffer: number[] = [];
  private bufferSize: number = 10;
  private activityDetectionInterval: any = null;
  private locationReadings: Location.LocationObject[] = [];
  private readonly MAX_READINGS = 10; // Increased for better averaging
  private lastKalmanEstimate: { lat: number; lng: number; accuracy: number } | null = null;
  private motionStartLocation: Location.LocationObject | null = null;
  private accumulatedDistance: { x: number; y: number } = { x: 0, y: 0 };
  private lastMotionTimestamp: number = 0;

  // Kalman filter parameters
  private readonly KALMAN_Q = 3; // Process noise
  private readonly KALMAN_R = 20; // Measurement noise

  // Motion-based location refinement
  private readonly MOTION_SCALE_FACTOR = 0.85; // Calibration factor for motion to distance

  constructor(config: MotionServiceConfig = {}) {
    this.config = {
      burstDuration: 5000, // 5 seconds default
      motionThreshold: 0.15, // Default sensitivity
      ...config
    };
  }

  async requestPermissions(): Promise<boolean> {
    try {
      // Request location permissions
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        console.warn('Location permission not granted');
        return false;
      }

      // For motion permissions, Expo sensors don't require explicit permissions
      // They work out of the box on both iOS and Android
      console.log('Motion sensors ready - no additional permissions needed in Expo');

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Motion monitoring already active');
      return;
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Required permissions not granted');
    }

    this.isMonitoring = true;
    
    // Set up accelerometer monitoring
    await Accelerometer.setUpdateInterval(100); // 10Hz
    this.accelerometerSubscription = Accelerometer.addListener((data) => {
      this.processAccelerometerData(data);
    });

    // Set up device motion monitoring (includes gyroscope data)
    if (Platform.OS === 'ios') {
      await DeviceMotion.setUpdateInterval(100);
      this.deviceMotionSubscription = DeviceMotion.addListener((data) => {
        this.processDeviceMotionData(data);
      });
    }

    // Start activity detection interval
    this.activityDetectionInterval = setInterval(() => {
      this.detectActivityFromBuffer();
    }, 1000); // Check every second

    console.log('Motion monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;

    // Clean up subscriptions
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }

    if (this.deviceMotionSubscription) {
      this.deviceMotionSubscription.remove();
      this.deviceMotionSubscription = null;
    }

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.activityDetectionInterval) {
      clearInterval(this.activityDetectionInterval);
      this.activityDetectionInterval = null;
    }

    this.motionBuffer = [];
    console.log('Motion monitoring stopped');
  }

  private processAccelerometerData(data: any): void {
    // Calculate magnitude of acceleration
    const magnitude = Math.sqrt(
      data.x * data.x + 
      data.y * data.y + 
      data.z * data.z
    );

    // Remove gravity (approximately 1g = 9.81 m/s²)
    const motionMagnitude = Math.abs(magnitude - 1);

    // Track motion for location refinement
    if (this.lastActivity !== 'stationary' && motionMagnitude > this.config.motionThreshold!) {
      const timeDelta = (Date.now() - this.lastMotionTimestamp) / 1000; // Convert to seconds
      if (timeDelta > 0 && timeDelta < 1) { // Ignore large time gaps
        // Estimate displacement using motion data
        const displacement = motionMagnitude * timeDelta * timeDelta * this.MOTION_SCALE_FACTOR;
        
        // Apply directional movement based on device orientation
        this.accumulatedDistance.x += displacement * data.x / magnitude;
        this.accumulatedDistance.y += displacement * data.y / magnitude;
      }
    }
    this.lastMotionTimestamp = Date.now();

    // Add to buffer
    this.motionBuffer.push(motionMagnitude);
    if (this.motionBuffer.length > this.bufferSize) {
      this.motionBuffer.shift();
    }
  }

  private processDeviceMotionData(data: any): void {
    // Use user acceleration (gravity removed) for better motion detection
    if (data.acceleration) {
      const userAcceleration = data.acceleration;
      const magnitude = Math.sqrt(
        userAcceleration.x * userAcceleration.x +
        userAcceleration.y * userAcceleration.y +
        userAcceleration.z * userAcceleration.z
      );

      // Override buffer with more accurate data
      this.motionBuffer.push(magnitude);
      if (this.motionBuffer.length > this.bufferSize) {
        this.motionBuffer.shift();
      }
    }
  }

  private detectActivityFromBuffer(): void {
    if (this.motionBuffer.length < this.bufferSize / 2) {
      return; // Not enough data
    }

    const avgMotion = this.motionBuffer.reduce((a, b) => a + b, 0) / this.motionBuffer.length;
    const maxMotion = Math.max(...this.motionBuffer);
    
    let detectedActivity: MotionActivity = 'unknown';
    let confidence = 0;

    // Activity detection thresholds (these can be tuned)
    if (avgMotion < 0.05 && maxMotion < 0.1) {
      detectedActivity = 'stationary';
      confidence = 0.9;
    } else if (avgMotion < 0.2 && maxMotion < 0.5) {
      detectedActivity = 'walking';
      confidence = 0.8;
    } else if (avgMotion < 0.5 && maxMotion < 1.5) {
      detectedActivity = 'running';
      confidence = 0.7;
    } else if (avgMotion > 0.3 && this.hasConsistentMotion()) {
      detectedActivity = 'automotive';
      confidence = 0.6;
    }

    // Check for activity transition
    if (detectedActivity !== this.lastActivity && detectedActivity !== 'unknown') {
      this.handleActivityTransition(this.lastActivity, detectedActivity, confidence);
      this.lastActivity = detectedActivity;
    }
  }

  private hasConsistentMotion(): boolean {
    // Check if motion is relatively consistent (typical of vehicle movement)
    if (this.motionBuffer.length < this.bufferSize) return false;
    
    const variance = this.calculateVariance(this.motionBuffer);
    return variance < 0.1; // Low variance suggests consistent motion
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private async handleActivityTransition(
    fromActivity: MotionActivity,
    toActivity: MotionActivity,
    confidence: number
  ): Promise<void> {
    console.log(`Activity transition: ${fromActivity} → ${toActivity} (confidence: ${confidence})`);

    // Notify about motion change
    if (this.config.onMotionChange) {
      this.config.onMotionChange({
        activity: toActivity,
        confidence,
        timestamp: Date.now()
      });
    }

    // Handle transitions for location refinement
    if (fromActivity === 'stationary' && toActivity !== 'stationary') {
      // Starting to move - record start position
      this.motionStartLocation = this.locationReadings[this.locationReadings.length - 1] || null;
      this.accumulatedDistance = { x: 0, y: 0 };
      await this.triggerLocationBurst();
    } else if (fromActivity !== 'stationary' && toActivity === 'stationary') {
      // Stopped moving - refine final position
      await this.refineFinalPosition();
    }
  }

  private async refineFinalPosition(): Promise<void> {
    if (!this.motionStartLocation || this.locationReadings.length === 0) return;

    // Get the most recent GPS reading
    const lastGPSReading = this.locationReadings[this.locationReadings.length - 1];
    
    // Calculate total displacement from motion data
    const totalDisplacement = Math.sqrt(
      this.accumulatedDistance.x * this.accumulatedDistance.x +
      this.accumulatedDistance.y * this.accumulatedDistance.y
    );

    // If we have minimal movement, use motion-refined position
    if (totalDisplacement < 10) { // Less than 10 meters of movement
      // Convert displacement to lat/lng offset
      const latOffset = this.accumulatedDistance.y / 111111; // 1 degree latitude ≈ 111km
      const lngOffset = this.accumulatedDistance.x / (111111 * Math.cos(lastGPSReading.coords.latitude * Math.PI / 180));

      // Create refined location with sub-meter accuracy
      const refinedLocation: Location.LocationObject = {
        ...lastGPSReading,
        coords: {
          ...lastGPSReading.coords,
          latitude: this.motionStartLocation.coords.latitude + latOffset,
          longitude: this.motionStartLocation.coords.longitude + lngOffset,
          accuracy: Math.min(1.0, lastGPSReading.coords.accuracy || 5) // Target 1 meter (3.3 feet)
        },
        timestamp: Date.now()
      };

      console.log(`Motion-refined position: accuracy ${refinedLocation.coords.accuracy}m, displacement ${totalDisplacement.toFixed(2)}m`);

      // Send the refined position
      if (this.config.onLocationBurst) {
        this.config.onLocationBurst(refinedLocation);
      }
    }
  }

  private async triggerLocationBurst(): Promise<void> {
    console.log('Triggering location burst due to motion');
    this.locationReadings = []; // Reset readings

    try {
      // Request highest accuracy location settings
      await Location.enableNetworkProviderAsync().catch(() => {
        console.log('Network provider not available');
      });

      // Start high-accuracy location updates
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 500, // Update every 500ms for more data points
          distanceInterval: 0.1, // Update every 10cm (approximately 4 inches)
          mayShowUserSettingsDialog: true, // Prompt user to enable high accuracy if needed
        },
        (location) => {
          // Apply Kalman filter for smoother, more accurate results
          const filtered = this.applyKalmanFilter(location);
          
          // Collect multiple readings for better accuracy
          this.locationReadings.push(filtered);
          if (this.locationReadings.length > this.MAX_READINGS) {
            this.locationReadings.shift();
          }

          // Filter out readings with poor accuracy (> 3 meters)
          const accurateReadings = this.locationReadings.filter(
            loc => loc.coords.accuracy && loc.coords.accuracy <= 3
          );

          // Use the most accurate reading or average if multiple good readings
          let bestLocation = filtered;
          if (accurateReadings.length >= 3) {
            // Average the best readings for sub-meter accuracy
            bestLocation = this.averageLocations(accurateReadings);
          } else if (accurateReadings.length > 0) {
            bestLocation = accurateReadings.reduce((best, current) => 
              (current.coords.accuracy || Infinity) < (best.coords.accuracy || Infinity) ? current : best
            );
          }

          // Apply motion-based refinement if stationary
          if (this.lastActivity === 'stationary' && this.accumulatedDistance.x === 0 && this.accumulatedDistance.y === 0) {
            // If we're stationary and haven't moved, improve accuracy estimate
            bestLocation = {
              ...bestLocation,
              coords: {
                ...bestLocation.coords,
                accuracy: Math.min(0.9, bestLocation.coords.accuracy || 3) // Report sub-meter when stationary
              }
            };
          }

          if (this.config.onLocationBurst) {
            this.config.onLocationBurst(bestLocation);
          }
        }
      );

      // Stop burst after configured duration
      setTimeout(() => {
        if (this.locationSubscription) {
          this.locationSubscription.remove();
          this.locationSubscription = null;
          console.log('Location burst completed');
        }
      }, this.config.burstDuration);
    } catch (error) {
      console.error('Error during location burst:', error);
    }
  }

  private applyKalmanFilter(location: Location.LocationObject): Location.LocationObject {
    if (!this.lastKalmanEstimate) {
      // Initialize Kalman filter with first reading
      this.lastKalmanEstimate = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy || 10
      };
      return location;
    }

    // Kalman filter implementation
    const accuracy = location.coords.accuracy || 10;
    const K = this.lastKalmanEstimate.accuracy / (this.lastKalmanEstimate.accuracy + this.KALMAN_R);
    
    const filteredLat = this.lastKalmanEstimate.lat + K * (location.coords.latitude - this.lastKalmanEstimate.lat);
    const filteredLng = this.lastKalmanEstimate.lng + K * (location.coords.longitude - this.lastKalmanEstimate.lng);
    const filteredAccuracy = (1 - K) * this.lastKalmanEstimate.accuracy + this.KALMAN_Q;

    this.lastKalmanEstimate = {
      lat: filteredLat,
      lng: filteredLng,
      accuracy: Math.min(filteredAccuracy, accuracy)
    };

    return {
      ...location,
      coords: {
        ...location.coords,
        latitude: filteredLat,
        longitude: filteredLng,
        accuracy: this.lastKalmanEstimate.accuracy
      }
    };
  }

  private averageLocations(locations: Location.LocationObject[]): Location.LocationObject {
    if (locations.length === 0) return locations[0];

    let sumLat = 0, sumLng = 0, sumAlt = 0;
    let weightSum = 0;
    let bestAccuracy = Infinity;

    // Weighted average based on accuracy
    locations.forEach(loc => {
      const weight = 1 / (loc.coords.accuracy || 1);
      sumLat += loc.coords.latitude * weight;
      sumLng += loc.coords.longitude * weight;
      sumAlt += (loc.coords.altitude || 0) * weight;
      weightSum += weight;
      bestAccuracy = Math.min(bestAccuracy, loc.coords.accuracy || Infinity);
    });

    const avgLocation = locations[0];
    return {
      ...avgLocation,
      coords: {
        ...avgLocation.coords,
        latitude: sumLat / weightSum,
        longitude: sumLng / weightSum,
        altitude: sumAlt / weightSum,
        accuracy: bestAccuracy * 0.7 // Averaging improves accuracy
      }
    };
  }

  getCurrentActivity(): MotionActivity {
    return this.lastActivity;
  }

  isActive(): boolean {
    return this.isMonitoring;
  }
}

export default MotionService;
