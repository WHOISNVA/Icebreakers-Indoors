import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  altitudeAccuracy?: number;
}

export interface FilteredLocationData extends LocationData {
  isFiltered: boolean;
  filterReason?: string;
  smoothedLatitude?: number;
  smoothedLongitude?: number;
}

export interface LocationConfig {
  // Accuracy and filtering
  accuracyThreshold: number; // meters - filter out locations with accuracy > threshold
  maxSpeedThreshold: number; // m/s - filter out impossible speeds
  distanceFilter: number; // meters - minimum distance between updates
  
  // Smoothing algorithms
  enableKalmanFilter: boolean;
  enableExponentialSmoothing: boolean;
  smoothingFactor: number; // 0-1, higher = more responsive to new data
  
  // Location provider preferences
  preferNetworkForIndoor: boolean; // Use network/WiFi for better indoor accuracy
}

class EnhancedLocationService {
  private config: LocationConfig = {
    accuracyThreshold: 25, // meters
    maxSpeedThreshold: 50, // m/s (180 km/h)
    distanceFilter: 10, // meters
    enableKalmanFilter: true,
    enableExponentialSmoothing: false,
    smoothingFactor: 0.3,
    preferNetworkForIndoor: true,
  };

  // Kalman filter state
  private kalmanState = {
    latitude: 0,
    longitude: 0,
    variance: 1000,
    initialized: false,
  };

  // Exponential smoothing state
  private smoothedLocation: { latitude: number; longitude: number } | null = null;

  // Location history for filtering
  private locationHistory: LocationData[] = [];
  private maxHistorySize = 10;

  // Subscription tracking
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;

  /**
   * Update configuration
   */
  public setConfig(config: Partial<LocationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): LocationConfig {
    return { ...this.config };
  }

  /**
   * Request location permissions
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission not granted');
        return false;
      }

      // Request background permissions for continuous tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted');
      }

      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  /**
   * Get current location with enhanced accuracy
   */
  public async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: this.config.preferNetworkForIndoor 
          ? Location.Accuracy.Balanced 
          : Location.Accuracy.BestForNavigation,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? 0,
        timestamp: location.timestamp,
        speed: location.coords.speed ?? undefined,
        heading: location.coords.heading ?? undefined,
        altitude: location.coords.altitude ?? undefined,
        altitudeAccuracy: location.coords.altitudeAccuracy ?? undefined,
      };

      return locationData;
    } catch (error) {
      console.error('Get current location error:', error);
      return null;
    }
  }

  /**
   * Start tracking location with filtering and smoothing
   */
  public async startTracking(
    onLocationUpdate: (location: LocationData) => void,
    onError?: (error: any) => void
  ): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      this.isTracking = true;

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: this.config.preferNetworkForIndoor 
            ? Location.Accuracy.Balanced 
            : Location.Accuracy.BestForNavigation,
          distanceInterval: this.config.distanceFilter,
          timeInterval: 1000, // Update every second
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 0,
            timestamp: location.timestamp,
            speed: location.coords.speed ?? undefined,
            heading: location.coords.heading ?? undefined,
            altitude: location.coords.altitude ?? undefined,
            altitudeAccuracy: location.coords.altitudeAccuracy ?? undefined,
          };

          // Process the location with filtering and smoothing
          const processedLocation = this.processLocation(locationData);

          if (!processedLocation.isFiltered) {
            // Only update with non-filtered locations
            const finalLocation: LocationData = {
              ...locationData,
              latitude: processedLocation.smoothedLatitude ?? locationData.latitude,
              longitude: processedLocation.smoothedLongitude ?? locationData.longitude,
            };
            onLocationUpdate(finalLocation);
          } else {
            console.warn('Location filtered:', processedLocation.filterReason);
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Start tracking error:', error);
      onError?.(error);
      return false;
    }
  }

  /**
   * Stop tracking location
   */
  public stopTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    this.isTracking = false;
    
    // Reset filter state
    this.kalmanState.initialized = false;
    this.smoothedLocation = null;
    this.locationHistory = [];
  }

  /**
   * Check if currently tracking
   */
  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Filter location data based on accuracy and speed thresholds
   */
  private filterLocation(location: LocationData): FilteredLocationData {
    const filtered: FilteredLocationData = {
      ...location,
      isFiltered: false,
    };

    // Filter by accuracy
    if (location.accuracy > this.config.accuracyThreshold) {
      filtered.isFiltered = true;
      filtered.filterReason = `Accuracy too low: ${location.accuracy.toFixed(1)}m > ${this.config.accuracyThreshold}m`;
      return filtered;
    }

    // Filter by speed (if available)
    if (location.speed && location.speed > this.config.maxSpeedThreshold) {
      filtered.isFiltered = true;
      filtered.filterReason = `Speed too high: ${(location.speed * 3.6).toFixed(1)} km/h > ${(this.config.maxSpeedThreshold * 3.6).toFixed(1)} km/h`;
      return filtered;
    }

    // Filter by sudden jumps (compare with previous location)
    if (this.locationHistory.length > 0) {
      const lastLocation = this.locationHistory[this.locationHistory.length - 1];
      const timeDiff = (location.timestamp - lastLocation.timestamp) / 1000; // seconds
      const distance = this.calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        location.latitude,
        location.longitude
      );

      if (timeDiff > 0) {
        const speed = distance / timeDiff;
        if (speed > this.config.maxSpeedThreshold) {
          filtered.isFiltered = true;
          filtered.filterReason = `Sudden jump detected: ${(speed * 3.6).toFixed(1)} km/h`;
          return filtered;
        }
      }
    }

    return filtered;
  }

  /**
   * Apply Kalman filter to smooth location data
   */
  private applyKalmanFilter(location: LocationData): { latitude: number; longitude: number } {
    if (!this.kalmanState.initialized) {
      this.kalmanState.latitude = location.latitude;
      this.kalmanState.longitude = location.longitude;
      this.kalmanState.variance = location.accuracy * location.accuracy;
      this.kalmanState.initialized = true;
      return { latitude: location.latitude, longitude: location.longitude };
    }

    // Kalman filter prediction
    const processNoise = 0.1; // Process noise variance
    const measurementNoise = location.accuracy * location.accuracy;

    // Prediction step
    this.kalmanState.variance += processNoise;

    // Update step (Kalman gain)
    const kalmanGain = this.kalmanState.variance / (this.kalmanState.variance + measurementNoise);

    // Update estimate
    this.kalmanState.latitude += kalmanGain * (location.latitude - this.kalmanState.latitude);
    this.kalmanState.longitude += kalmanGain * (location.longitude - this.kalmanState.longitude);
    this.kalmanState.variance *= (1 - kalmanGain);

    return { 
      latitude: this.kalmanState.latitude, 
      longitude: this.kalmanState.longitude 
    };
  }

  /**
   * Apply exponential smoothing to location data
   */
  private applyExponentialSmoothing(location: LocationData): { latitude: number; longitude: number } {
    if (!this.smoothedLocation) {
      this.smoothedLocation = { latitude: location.latitude, longitude: location.longitude };
      return this.smoothedLocation;
    }

    const alpha = this.config.smoothingFactor;
    this.smoothedLocation.latitude = alpha * location.latitude + (1 - alpha) * this.smoothedLocation.latitude;
    this.smoothedLocation.longitude = alpha * location.longitude + (1 - alpha) * this.smoothedLocation.longitude;

    return { ...this.smoothedLocation };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Process and enhance location data
   */
  private processLocation(location: LocationData): FilteredLocationData {
    // Filter the location
    const filtered = this.filterLocation(location);

    if (filtered.isFiltered) {
      return filtered;
    }

    // Add to history
    this.locationHistory.push(location);
    if (this.locationHistory.length > this.maxHistorySize) {
      this.locationHistory.shift();
    }

    // Apply smoothing
    if (this.config.enableKalmanFilter) {
      const kalmanResult = this.applyKalmanFilter(location);
      filtered.smoothedLatitude = kalmanResult.latitude;
      filtered.smoothedLongitude = kalmanResult.longitude;
    } else if (this.config.enableExponentialSmoothing) {
      const smoothedResult = this.applyExponentialSmoothing(location);
      filtered.smoothedLatitude = smoothedResult.latitude;
      filtered.smoothedLongitude = smoothedResult.longitude;
    }

    return filtered;
  }

  /**
   * Get location history
   */
  public getLocationHistory(): LocationData[] {
    return [...this.locationHistory];
  }

  /**
   * Clear location history and reset filters
   */
  public reset(): void {
    this.locationHistory = [];
    this.kalmanState.initialized = false;
    this.smoothedLocation = null;
  }
}

export default new EnhancedLocationService();

