import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// Types and interfaces
export interface GNSSReading {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  hdop?: number;
  vdop?: number;
  pdop?: number;
}

export interface FilteredLocation {
  location: GNSSReading;
  confidence: number;
  source: 'gnss' | 'filtered' | 'fused';
  jumpDetected: boolean;
}

export interface LocationServiceConfig {
  onLocationUpdate?: (location: FilteredLocation) => void;
  onLocationError?: (error: string) => void;
  maxAccuracyThreshold?: number; // meters
  maxJumpDistance?: number; // meters
  smoothingFactor?: number; // 0-1
  minUpdateInterval?: number; // milliseconds
  enableBackgroundUpdates?: boolean;
}

// Background task name
const BACKGROUND_LOCATION_TASK = 'background-location-task';

class AdvancedLocationService {
  private config: LocationServiceConfig;
  private isActive: boolean = false;
  private backgroundSubscription: any = null;
  private foregroundSubscription: any = null;
  
  // Location history and filtering
  private locationHistory: GNSSReading[] = [];
  private lastGoodLocation: GNSSReading | null = null;
  private kalmanFilter: KalmanLocationFilter;
  private movingAverageFilter: MovingAverageFilter;
  
  // Quality metrics
  private consecutiveBadReadings: number = 0;
  private totalReadings: number = 0;
  private goodReadings: number = 0;

  constructor(config: LocationServiceConfig = {}) {
    this.config = {
      maxAccuracyThreshold: 15, // meters
      maxJumpDistance: 100, // meters  
      smoothingFactor: 0.3,
      minUpdateInterval: 500, // 500ms
      enableBackgroundUpdates: false,
      ...config
    };

    this.kalmanFilter = new KalmanLocationFilter();
    this.movingAverageFilter = new MovingAverageFilter(5);
    
    // Register background task
    this.registerBackgroundTask();
  }

  private registerBackgroundTask(): void {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
      if (error) {
        console.error('Background location error:', error);
        this.config.onLocationError?.(error.message);
        return;
      }

      if (data) {
        const { locations } = data as any;
        if (locations && locations.length > 0) {
          const location = locations[0];
          this.processLocationReading(this.convertToGNSSReading(location));
        }
      }
    });
  }

  async requestPermissions(): Promise<boolean> {
    try {
      // Request foreground location permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.warn('Foreground location permission not granted');
        return false;
      }

      // Request background location permission if needed
      if (this.config.enableBackgroundUpdates) {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.warn('Background location permission not granted');
          // Continue without background updates
          this.config.enableBackgroundUpdates = false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async startContinuousTracking(): Promise<void> {
    if (this.isActive) {
      console.log('Location tracking already active');
      return;
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Location permissions not granted');
    }

    this.isActive = true;

    // Configure high-accuracy location settings
    const locationOptions: Location.LocationOptions = {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: this.config.minUpdateInterval!,
      distanceInterval: 0, // Get all updates regardless of distance
      ...(Platform.OS === 'ios' && {
        activityType: Location.ActivityType.OtherNavigation, // Best for cruise ships
        showsBackgroundLocationIndicator: true,
      }),
    };

    try {
      // Start foreground location tracking
      this.foregroundSubscription = await Location.watchPositionAsync(
        locationOptions,
        (location) => {
          this.processLocationReading(this.convertToGNSSReading(location));
        }
      );

      // Start background location tracking if enabled
      if (this.config.enableBackgroundUpdates) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          ...locationOptions,
          deferredUpdatesInterval: 5000, // 5 seconds for background
          foregroundService: Platform.OS === 'android' ? {
            notificationTitle: 'Location Tracking',
            notificationBody: 'Tracking your location for delivery service',
          } : undefined,
        });
      }

      console.log('Continuous location tracking started');
    } catch (error) {
      this.isActive = false;
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  async stopTracking(): Promise<void> {
    this.isActive = false;

    // Stop foreground tracking
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }

    // Stop background tracking
    if (this.config.enableBackgroundUpdates) {
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      } catch (error) {
        console.warn('Error stopping background location updates:', error);
      }
    }

    // Reset state
    this.locationHistory = [];
    this.lastGoodLocation = null;
    this.consecutiveBadReadings = 0;
    this.kalmanFilter.reset();
    this.movingAverageFilter.reset();

    console.log('Location tracking stopped');
  }

  private convertToGNSSReading(location: Location.LocationObject): GNSSReading {
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: location.timestamp,
    };
  }

  private processLocationReading(reading: GNSSReading): void {
    this.totalReadings++;

    // Quality check: reject readings with poor accuracy
    if (reading.accuracy && reading.accuracy > this.config.maxAccuracyThreshold!) {
      this.consecutiveBadReadings++;
      console.log(`Rejected reading: accuracy ${reading.accuracy}m > ${this.config.maxAccuracyThreshold}m`);
      return;
    }

    // Jump detection: check for sudden position changes
    const jumpDetected = this.detectLocationJump(reading);
    if (jumpDetected && this.lastGoodLocation) {
      this.consecutiveBadReadings++;
      console.log('Location jump detected, rejecting reading');
      return;
    }

    // Reset consecutive bad readings counter
    this.consecutiveBadReadings = 0;
    this.goodReadings++;

    // Add to history
    this.locationHistory.push(reading);
    if (this.locationHistory.length > 20) {
      this.locationHistory.shift();
    }

    // Apply filtering
    const filteredLocation = this.applyFiltering(reading);

    // Update last good location
    this.lastGoodLocation = filteredLocation.location;

    // Emit filtered location
    this.config.onLocationUpdate?.(filteredLocation);
  }

  private detectLocationJump(reading: GNSSReading): boolean {
    if (!this.lastGoodLocation) return false;

    const distance = this.calculateDistance(
      this.lastGoodLocation.latitude,
      this.lastGoodLocation.longitude,
      reading.latitude,
      reading.longitude
    );

    const timeDiff = (reading.timestamp - this.lastGoodLocation.timestamp) / 1000; // seconds
    const maxPossibleDistance = timeDiff * 50; // 50 m/s = ~100 mph max reasonable speed

    return distance > Math.max(this.config.maxJumpDistance!, maxPossibleDistance);
  }

  private applyFiltering(reading: GNSSReading): FilteredLocation {
    // Apply Kalman filter
    const kalmanFiltered = this.kalmanFilter.update(reading);
    
    // Apply moving average
    const averageFiltered = this.movingAverageFilter.update(kalmanFiltered);

    // Calculate confidence based on accuracy and history
    let confidence = 0.5;
    if (reading.accuracy) {
      confidence = Math.max(0, 1 - (reading.accuracy / this.config.maxAccuracyThreshold!));
    }

    // Boost confidence for consistent readings
    const historyConsistency = this.calculateHistoryConsistency();
    confidence = Math.min(1, confidence + historyConsistency * 0.3);

    return {
      location: averageFiltered,
      confidence,
      source: 'filtered',
      jumpDetected: false
    };
  }

  private calculateHistoryConsistency(): number {
    if (this.locationHistory.length < 3) return 0;

    const recent = this.locationHistory.slice(-3);
    const distances = [];

    for (let i = 1; i < recent.length; i++) {
      const dist = this.calculateDistance(
        recent[i-1].latitude,
        recent[i-1].longitude,
        recent[i].latitude,
        recent[i].longitude
      );
      distances.push(dist);
    }

    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((sum, dist) => sum + Math.pow(dist - avgDistance, 2), 0) / distances.length;

    // Lower variance = higher consistency
    return Math.max(0, 1 - variance / 100);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  getQualityMetrics() {
    return {
      totalReadings: this.totalReadings,
      goodReadings: this.goodReadings,
      qualityRatio: this.totalReadings > 0 ? this.goodReadings / this.totalReadings : 0,
      consecutiveBadReadings: this.consecutiveBadReadings,
      historySize: this.locationHistory.length
    };
  }

  getCurrentLocation(): GNSSReading | null {
    return this.lastGoodLocation;
  }

  isTracking(): boolean {
    return this.isActive;
  }
}

// Kalman Filter for location smoothing
class KalmanLocationFilter {
  private Q: number = 3; // Process noise
  private R: number = 10; // Measurement noise
  private P: number = 100; // Estimation error
  private K: number = 0; // Kalman gain
  
  private lastEstimate: GNSSReading | null = null;

  update(measurement: GNSSReading): GNSSReading {
    if (!this.lastEstimate) {
      this.lastEstimate = { ...measurement };
      return measurement;
    }

    // Prediction step
    const timeDelta = (measurement.timestamp - this.lastEstimate.timestamp) / 1000;
    this.P += this.Q * timeDelta;

    // Update step
    this.K = this.P / (this.P + this.R);
    
    const filteredLat = this.lastEstimate.latitude + this.K * (measurement.latitude - this.lastEstimate.latitude);
    const filteredLon = this.lastEstimate.longitude + this.K * (measurement.longitude - this.lastEstimate.longitude);
    
    this.P = (1 - this.K) * this.P;

    this.lastEstimate = {
      ...measurement,
      latitude: filteredLat,
      longitude: filteredLon
    };

    return this.lastEstimate;
  }

  reset(): void {
    this.lastEstimate = null;
    this.P = 100;
  }
}

// Moving Average Filter
class MovingAverageFilter {
  private buffer: GNSSReading[] = [];
  private windowSize: number;

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
  }

  update(reading: GNSSReading): GNSSReading {
    this.buffer.push(reading);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    if (this.buffer.length === 1) {
      return reading;
    }

    // Calculate weighted average (more weight on recent readings)
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLon = 0;

    this.buffer.forEach((point, index) => {
      const weight = index + 1; // Linear weighting
      totalWeight += weight;
      weightedLat += point.latitude * weight;
      weightedLon += point.longitude * weight;
    });

    return {
      ...reading,
      latitude: weightedLat / totalWeight,
      longitude: weightedLon / totalWeight
    };
  }

  reset(): void {
    this.buffer = [];
  }
}

export default AdvancedLocationService;
