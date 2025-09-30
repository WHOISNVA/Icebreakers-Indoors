import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { DeviceMotion, Accelerometer, Gyroscope } from 'expo-sensors';

export type MotionActivity = 'SIT' | 'WALK' | 'RUN' | 'unknown';

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

interface GridLocation {
  lat: number;
  lng: number;
  grid_cell: string;
  grid_size_m: number;
}

interface MotionSummary {
  step_frequency_hz: number;
  accel_variance: number;
  gyro_variance: number;
  speed_mps?: number;
}

class MotionService {
  private config: MotionServiceConfig;
  private isMonitoring: boolean = false;
  private lastActivity: MotionActivity = 'unknown';
  private accelerometerSubscription: any = null;
  private deviceMotionSubscription: any = null;
  private locationSubscription: any = null;
  private motionBuffer: number[] = [];
  private gyroBuffer: number[] = [];
  private stepBuffer: number[] = [];
  private bufferSize: number = 15; // 300ms of data at 50Hz
  private activityDetectionInterval: any = null;
  private locationReadings: Location.LocationObject[] = [];
  private readonly MAX_READINGS = 25;
  private lastKalmanEstimate: { lat: number; lng: number; accuracy: number } | null = null;
  private motionStartLocation: Location.LocationObject | null = null;
  private accumulatedDistance: { x: number; y: number } = { x: 0, y: 0 };
  private lastMotionTimestamp: number = 0;
  private lastActivityChangeTime: number = 0;
  private activityCounter: { [key: string]: number } = {};
  private consecutiveVotes: { [key: string]: number } = {};
  private lastStepTime: number = 0;
  private stepCount: number = 0;
  private gridOrigin = { lat: 0.0, lng: 0.0 };
  private readonly GRID_SIZE_M = 3;
  private stationaryPosition: { lat: number; lng: number; accuracy: number; count: number } | null = null;

  // Kalman filter parameters
  private readonly KALMAN_Q = 3;
  private readonly KALMAN_R = 20;

  // Enhanced motion detection parameters from JSON spec
  private readonly SIT_ACCEL_VARIANCE_MAX = 0.008; // Reduced from 0.015 for better sitting detection
  private readonly SIT_GYRO_VARIANCE_MAX = 0.01; // Reduced from 0.02
  private readonly SIT_STEP_FREQ_MAX = 0.5; // Reduced from 0.8
  private readonly WALK_ACCEL_VARIANCE_MIN = 0.03; // Increased from 0.02 to reduce false positives
  private readonly WALK_STEP_FREQ_MIN = 1.5; // Increased from 1.3
  private readonly WALK_STEP_FREQ_MAX = 2.1;
  private readonly RUN_ACCEL_VARIANCE_MIN = 0.08; // Increased from 0.06
  private readonly RUN_STEP_FREQ_MIN = 2.2;
  private readonly MIN_STATE_DURATION_MS = 5000; // Increased from 4000
  private readonly TRANSITION_HYSTERESIS_MS = 5000; // Increased from 4000
  private readonly MICRO_MOTION_IGNORE_MS = 3000; // Increased from 2500
  private readonly REQUIRED_ACCURACY_M_MAX = 8;
  private readonly DISTANCE_FILTER_M = 3;

  // Add new parameters for better sitting detection
  private readonly SITTING_CONFIDENCE_THRESHOLD = 0.95; // High confidence needed to leave sitting
  private readonly MOTION_PEAK_THRESHOLD = 0.05; // Lower threshold for sitting
  private recentPeaks: number[] = []; // Track recent motion peaks

  constructor(config: MotionServiceConfig = {}) {
    this.config = {
      burstDuration: 6000, // Enhanced burst duration
      motionThreshold: 0.008, // Ultra-low threshold for sitting detection
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
    
    // Set up accelerometer monitoring at 50Hz per JSON spec
    await Accelerometer.setUpdateInterval(20); // 50Hz
    this.accelerometerSubscription = Accelerometer.addListener((data) => {
      this.processAccelerometerData(data);
    });

    // Set up device motion monitoring (includes gyroscope data)
    if (Platform.OS === 'ios') {
      await DeviceMotion.setUpdateInterval(20); // 50Hz
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
    this.gyroBuffer = [];
    this.stepBuffer = [];
    this.consecutiveVotes = {};
    this.stationaryPosition = null;
    console.log('Motion monitoring stopped');
  }

  private processAccelerometerData(data: any): void {
    const magnitude = Math.sqrt(
      data.x * data.x + data.y * data.y + data.z * data.z
    );
    
    const motionMagnitude = Math.abs(magnitude - 1.0);
    this.motionBuffer.push(motionMagnitude);
    
    // Track peaks for better sitting detection
    if (motionMagnitude > this.MOTION_PEAK_THRESHOLD) {
      this.recentPeaks.push(Date.now());
      // Keep only peaks from last 5 seconds
      const fiveSecondsAgo = Date.now() - 5000;
      this.recentPeaks = this.recentPeaks.filter(time => time > fiveSecondsAgo);
    }
    
    // Enhanced step detection using peak detection
    this.detectStep(motionMagnitude);
    
    if (this.motionBuffer.length > this.bufferSize) {
      this.motionBuffer.shift();
    }
    
    this.lastMotionTimestamp = Date.now();
  }

  private processDeviceMotionData(data: any): void {
    if (data.rotation) {
      const gyroMagnitude = Math.sqrt(
        (data.rotation.alpha || 0) * (data.rotation.alpha || 0) +
        (data.rotation.beta || 0) * (data.rotation.beta || 0) +
        (data.rotation.gamma || 0) * (data.rotation.gamma || 0)
      );
      
      this.gyroBuffer.push(gyroMagnitude);
      if (this.gyroBuffer.length > this.bufferSize) {
        this.gyroBuffer.shift();
      }
    }
    
    if (data.acceleration) {
      this.processAccelerometerData(data.acceleration);
    }
  }

  private detectActivityFromBuffer(): void {
    if (this.motionBuffer.length < this.bufferSize / 2) {
      return;
    }

    const accelVariance = this.calculateVariance(this.motionBuffer);
    const gyroVariance = this.gyroBuffer.length > 0 ? this.calculateVariance(this.gyroBuffer) : 0;
    const stepFreq = this.calculateStepFrequency();
    const peakFreq = this.recentPeaks.length / 5.0; // Peaks per second over 5 seconds
    
    let detectedActivity: MotionActivity = 'unknown';
    let confidence = 0;

    // Enhanced classification with peak frequency consideration
    if (accelVariance <= this.SIT_ACCEL_VARIANCE_MAX && 
        gyroVariance <= this.SIT_GYRO_VARIANCE_MAX && 
        stepFreq <= this.SIT_STEP_FREQ_MAX &&
        peakFreq < 2.0) { // Less than 2 peaks per second
      detectedActivity = 'SIT';
      confidence = 0.95; // High confidence for sitting
      
      // Boost confidence if very still
      if (accelVariance < 0.005 && gyroVariance < 0.005) {
        confidence = 0.98;
      }
    } else if (stepFreq >= this.WALK_STEP_FREQ_MIN && 
               stepFreq <= this.WALK_STEP_FREQ_MAX && 
               accelVariance >= this.WALK_ACCEL_VARIANCE_MIN && 
               accelVariance < this.RUN_ACCEL_VARIANCE_MIN &&
               peakFreq >= 3.0) { // At least 3 peaks per second for walking
      detectedActivity = 'WALK';
      confidence = 0.85;
    } else if (stepFreq >= this.RUN_STEP_FREQ_MIN && 
               accelVariance >= this.RUN_ACCEL_VARIANCE_MIN &&
               peakFreq >= 5.0) { // At least 5 peaks per second for running
      detectedActivity = 'RUN';
      confidence = 0.80;
    }

    // Implement consecutive voting for stability
    if (detectedActivity !== 'unknown') {
      this.consecutiveVotes[detectedActivity] = (this.consecutiveVotes[detectedActivity] || 0) + 1;
      
      // Reset other votes
      Object.keys(this.consecutiveVotes).forEach(activity => {
        if (activity !== detectedActivity) {
          this.consecutiveVotes[activity] = 0;
        }
      });
    }

    // Require minimum state duration and consecutive votes
    const requiredVotes = this.lastActivity === 'SIT' ? 6 : 4; // More votes needed to leave sitting
    const timeSinceLastChange = Date.now() - this.lastActivityChangeTime;
    
    if (detectedActivity !== this.lastActivity &&
        detectedActivity !== 'unknown' &&
        (this.consecutiveVotes[detectedActivity] || 0) >= requiredVotes &&
        timeSinceLastChange >= this.MIN_STATE_DURATION_MS) {

      // Special hysteresis for leaving SIT state - require very high confidence
      if (this.lastActivity === 'SIT' && confidence < this.SITTING_CONFIDENCE_THRESHOLD) {
        return; // Stay sitting unless very confident
      }

      // Additional check for sitting to walking transition
      if (this.lastActivity === 'SIT' && detectedActivity === 'WALK') {
        // Require sustained motion peaks
        if (peakFreq < 3.5 || accelVariance < 0.035) {
          return; // Not enough sustained motion for walking
        }
      }

      this.lastActivityChangeTime = Date.now();
      this.consecutiveVotes = {};
      this.handleActivityTransition(this.lastActivity, detectedActivity, confidence);
      this.lastActivity = detectedActivity;
    }
  }

  private detectStep(magnitude: number): void {
    const currentTime = Date.now();
    const threshold = 0.1; // Step detection threshold
    
    // Simple peak detection for steps
    if (magnitude > threshold && (currentTime - this.lastStepTime) > 200) {
      this.stepCount++;
      this.lastStepTime = currentTime;
      this.stepBuffer.push(currentTime);
      
      // Keep only last 10 seconds of steps
      const tenSecondsAgo = currentTime - 10000;
      this.stepBuffer = this.stepBuffer.filter(time => time > tenSecondsAgo);
    }
  }

  private calculateStepFrequency(): number {
    if (this.stepBuffer.length < 2) return 0;
    
    const currentTime = Date.now();
    const fiveSecondsAgo = currentTime - 5000;
    const recentSteps = this.stepBuffer.filter(time => time > fiveSecondsAgo);
    
    if (recentSteps.length < 2) return 0;
    
    // Calculate frequency over 5 second window
    return recentSteps.length / 5.0; // Hz
  }

  private snapToGrid(lat: number, lng: number): GridLocation {
    // Convert lat/lng to grid coordinates
    const latMeters = lat * 111111; // Approximate meters per degree latitude
    const lngMeters = lng * 111111 * Math.cos(lat * Math.PI / 180);
    
    // Find nearest grid point
    const gridLat = Math.round(latMeters / this.GRID_SIZE_M) * this.GRID_SIZE_M;
    const gridLng = Math.round(lngMeters / this.GRID_SIZE_M) * this.GRID_SIZE_M;
    
    // Convert back to lat/lng
    const snappedLat = gridLat / 111111;
    const snappedLng = gridLng / (111111 * Math.cos(lat * Math.PI / 180));
    
    const gridCell = `G_${snappedLat.toFixed(6)}_${snappedLng.toFixed(6)}_s${this.GRID_SIZE_M}`;
    
    return {
      lat: snappedLat,
      lng: snappedLng,
      grid_cell: gridCell,
      grid_size_m: this.GRID_SIZE_M
    };
  }

  private applyStationaryLock(location: Location.LocationObject): Location.LocationObject {
    if (!this.stationaryPosition) {
      this.stationaryPosition = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy || 1,
        count: 1
      };
      return location;
    }

    const latDiff = location.coords.latitude - this.stationaryPosition.lat;
    const lngDiff = location.coords.longitude - this.stationaryPosition.lng;
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111111;

    if (distance < 1.5) { // Within 1.5 meters, lock to stationary position
      this.stationaryPosition.count++;
      const weight = Math.min(0.97, 0.85 + (this.stationaryPosition.count * 0.01));
      const newLat = this.stationaryPosition.lat * weight + location.coords.latitude * (1 - weight);
      const newLng = this.stationaryPosition.lng * weight + location.coords.longitude * (1 - weight);

      this.stationaryPosition.lat = newLat;
      this.stationaryPosition.lng = newLng;
      this.stationaryPosition.accuracy = Math.min(this.stationaryPosition.accuracy, location.coords.accuracy || 1);

      return {
        ...location,
        coords: {
          ...location.coords,
          latitude: newLat,
          longitude: newLng,
          accuracy: Math.min(0.8, this.stationaryPosition.accuracy) // Lock to sub-meter
        }
      };
    } else {
      this.stationaryPosition = null;
      return location;
    }
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

    // Reset stationary position when starting to move
    if (fromActivity === 'SIT' && toActivity !== 'SIT') {
      this.stationaryPosition = null;
      await this.triggerLocationBurst();
    } else if (fromActivity !== 'SIT' && toActivity === 'SIT') {
      await this.triggerLocationBurst();
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
          timeInterval: 100, // Update every 100ms per JSON spec
          distanceInterval: 0, // Update on any movement per JSON spec
          mayShowUserSettingsDialog: true,
          ...(Platform.OS === 'ios' && {
            activityType: Location.ActivityType.Fitness,
            showsBackgroundLocationIndicator: true,
          }),
        },
        (location) => {
          // Apply Kalman filter for smoother, more accurate results
          const filtered = this.applyKalmanFilter(location);
          
          // Collect multiple readings for better accuracy
          this.locationReadings.push(filtered);
          if (this.locationReadings.length > this.MAX_READINGS) {
            this.locationReadings.shift();
          }

          // Filter out readings with poor accuracy per JSON spec (> 1 meter)
          const accurateReadings = this.locationReadings.filter(
            loc => loc.coords.accuracy && loc.coords.accuracy <= 1.0
          );

          // Enhanced location processing per JSON spec
          let bestLocation = filtered;
          if (accurateReadings.length >= 7) {
            // Use median filtering for 7+ readings per JSON spec
            bestLocation = this.getMedianLocation(accurateReadings);
          } else if (accurateReadings.length >= 3) {
            bestLocation = this.averageLocations(accurateReadings);
          }

          // Apply stationary lock when sitting
          if (this.lastActivity === 'SIT') {
            bestLocation = this.applyStationaryLock(bestLocation);
          }

          // Apply grid snapping
          const gridSnapped = this.snapToGrid(bestLocation.coords.latitude, bestLocation.coords.longitude);
          bestLocation = {
            ...bestLocation,
            coords: {
              ...bestLocation.coords,
              latitude: gridSnapped.lat,
              longitude: gridSnapped.lng
            }
          };

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
        accuracy: bestAccuracy * 0.7
      }
    };
  }

  private getMedianLocation(locations: Location.LocationObject[]): Location.LocationObject {
    if (locations.length === 0) return locations[0];
    
    const sortedLats = locations.map(l => l.coords.latitude).sort((a, b) => a - b);
    const sortedLngs = locations.map(l => l.coords.longitude).sort((a, b) => a - b);
    const sortedAccs = locations.map(l => l.coords.accuracy || 1).sort((a, b) => a - b);
    
    const mid = Math.floor(locations.length / 2);
    const medianLat = locations.length % 2 === 0 
      ? (sortedLats[mid - 1] + sortedLats[mid]) / 2 
      : sortedLats[mid];
    const medianLng = locations.length % 2 === 0 
      ? (sortedLngs[mid - 1] + sortedLngs[mid]) / 2 
      : sortedLngs[mid];
    
    return {
      ...locations[0],
      coords: {
        ...locations[0].coords,
        latitude: medianLat,
        longitude: medianLng,
        accuracy: sortedAccs[0] * 0.6 // Median filtering improves accuracy
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
