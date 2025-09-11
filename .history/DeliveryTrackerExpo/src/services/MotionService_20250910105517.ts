import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { DeviceMotion, Accelerometer, Gyroscope } from 'expo-sensors';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

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

      // Request motion permissions based on platform
      if (Platform.OS === 'ios') {
        const motionPermission = await check(PERMISSIONS.IOS.MOTION);
        if (motionPermission !== RESULTS.GRANTED) {
          const result = await request(PERMISSIONS.IOS.MOTION);
          if (result !== RESULTS.GRANTED) {
            console.warn('Motion permission not granted on iOS');
            return false;
          }
        }
      } else if (Platform.OS === 'android') {
        // Android doesn't require explicit motion permissions for accelerometer
        // But we might need activity recognition permission for Android 10+
        if (Platform.Version >= 29) {
          const activityPermission = await check(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);
          if (activityPermission !== RESULTS.GRANTED) {
            const result = await request(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);
            if (result !== RESULTS.GRANTED) {
              console.warn('Activity recognition permission not granted on Android');
              // Continue anyway as we can still use accelerometer
            }
          }
        }
      }

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

    // Trigger location burst on stationary → moving transition
    if (fromActivity === 'stationary' && toActivity !== 'stationary') {
      await this.triggerLocationBurst();
    }
  }

  private async triggerLocationBurst(): Promise<void> {
    console.log('Triggering location burst due to motion');

    try {
      // Start high-accuracy location updates
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 1, // Update every meter
        },
        (location) => {
          if (this.config.onLocationBurst) {
            this.config.onLocationBurst(location);
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

  getCurrentActivity(): MotionActivity {
    return this.lastActivity;
  }

  isActive(): boolean {
    return this.isMonitoring;
  }
}

export default MotionService;
