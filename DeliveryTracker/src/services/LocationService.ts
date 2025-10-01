import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid, Alert, Vibration } from 'react-native';
import { LOCATION_CONFIG } from '../config/maps';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  source?: 'gps' | 'network' | 'passive';
}

export interface FilteredLocationData extends LocationData {
  isFiltered: boolean;
  filterReason?: string;
  smoothedLatitude?: number;
  smoothedLongitude?: number;
}

export interface LocationServiceConfig {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
  distanceFilter: number;
  showLocationDialog: boolean;
  forceRequestLocation: boolean;
  forceLocationManager: boolean;
  fallbackToGooglePlayServices: boolean;
  // Enhanced accuracy settings
  accuracyThreshold: number; // meters
  enableKalmanFilter: boolean;
  enableExponentialSmoothing: boolean;
  smoothingFactor: number;
  maxSpeedThreshold: number; // m/s
  enablePingFeature: boolean;
  // WiFi and Cell signal enhancement
  enableWifiLocation: boolean;
  enableCellLocation: boolean;
  useNetworkProvider: boolean;
  preferGpsOverNetwork: boolean;
}

class LocationService {
  private watchId: number | null = null;
  private isTracking: boolean = false;
  private config: LocationServiceConfig = {
    enableHighAccuracy: LOCATION_CONFIG.ENABLE_HIGH_ACCURACY,
    timeout: LOCATION_CONFIG.TIMEOUT,
    maximumAge: LOCATION_CONFIG.MAXIMUM_AGE,
    distanceFilter: LOCATION_CONFIG.DISTANCE_FILTER,
    showLocationDialog: LOCATION_CONFIG.SHOW_LOCATION_DIALOG,
    forceRequestLocation: LOCATION_CONFIG.FORCE_REQUEST_LOCATION,
    forceLocationManager: LOCATION_CONFIG.FORCE_LOCATION_MANAGER,
    fallbackToGooglePlayServices: LOCATION_CONFIG.FALLBACK_TO_GOOGLE_PLAY_SERVICES,
    // Enhanced accuracy settings
    accuracyThreshold: LOCATION_CONFIG.ACCURACY_THRESHOLD,
    enableKalmanFilter: LOCATION_CONFIG.ENABLE_KALMAN_FILTER,
    enableExponentialSmoothing: LOCATION_CONFIG.ENABLE_EXPONENTIAL_SMOOTHING,
    smoothingFactor: LOCATION_CONFIG.SMOOTHING_FACTOR,
    maxSpeedThreshold: LOCATION_CONFIG.MAX_SPEED_THRESHOLD,
    enablePingFeature: LOCATION_CONFIG.ENABLE_PING_FEATURE,
    // WiFi and Cell signal enhancement
    enableWifiLocation: LOCATION_CONFIG.ENABLE_WIFI_LOCATION,
    enableCellLocation: LOCATION_CONFIG.ENABLE_CELL_LOCATION,
    useNetworkProvider: LOCATION_CONFIG.USE_NETWORK_PROVIDER,
    preferGpsOverNetwork: LOCATION_CONFIG.PREFER_GPS_OVER_NETWORK,
  };

  private onLocationUpdate?: (location: LocationData) => void;
  private onError?: (error: any) => void;
  
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

  constructor() {
    this.requestPermissions();
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
    
    // Update step
    const kalmanGain = this.kalmanState.variance / (this.kalmanState.variance + measurementNoise);
    
    this.kalmanState.latitude += kalmanGain * (location.latitude - this.kalmanState.latitude);
    this.kalmanState.longitude += kalmanGain * (location.longitude - this.kalmanState.longitude);
    this.kalmanState.variance *= (1 - kalmanGain);

    return { latitude: this.kalmanState.latitude, longitude: this.kalmanState.longitude };
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

    return this.smoothedLocation;
  }

  /**
   * Calculate distance between two coordinates
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
   * Trigger ping notification on the device
   */
  public triggerPing(): void {
    if (!this.config.enablePingFeature) {
      return;
    }

    // Vibrate the device
    Vibration.vibrate([0, 500, 200, 500]);
    
    // You can add sound notification here if needed
    console.log('Ping triggered - device should vibrate');
  }

  /**
   * Get enhanced location using multiple providers
   */
  public async getEnhancedLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      // Try to get location from multiple sources
      const locations: LocationData[] = [];

      // GPS location
      const gpsLocation = await this.getLocationFromProvider('gps');
      if (gpsLocation) {
        locations.push(gpsLocation);
      }

      // Network location (WiFi + Cell)
      if (this.config.enableWifiLocation || this.config.enableCellLocation) {
        const networkLocation = await this.getLocationFromProvider('network');
        if (networkLocation) {
          locations.push(networkLocation);
        }
      }

      // Choose the best location
      if (locations.length === 0) {
        return null;
      }

      if (locations.length === 1) {
        return locations[0];
      }

      // If we have multiple locations, choose the most accurate one
      const bestLocation = locations.reduce((best, current) => {
        if (this.config.preferGpsOverNetwork && best.source === 'gps' && current.source === 'network') {
          return best;
        }
        return current.accuracy < best.accuracy ? current : best;
      });

      return bestLocation;
    } catch (error) {
      console.error('Enhanced location error:', error);
      return null;
    }
  }

  /**
   * Get location from a specific provider
   */
  private async getLocationFromProvider(provider: 'gps' | 'network'): Promise<LocationData | null> {
    return new Promise((resolve, reject) => {
      const options = {
        ...this.config,
        enableHighAccuracy: provider === 'gps',
        timeout: this.config.timeout,
        maximumAge: this.config.maximumAge,
      };

      Geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            source: provider,
          };
          resolve(locationData);
        },
        (error) => {
          console.warn(`Location from ${provider} provider failed:`, error);
          resolve(null);
        },
        options
      );
    });
  }

  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        ]);

        const fineLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted';
        const coarseLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted';
        const backgroundLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION] === 'granted';

        if (!fineLocationGranted && !coarseLocationGranted) {
          Alert.alert(
            'Location Permission Required',
            'This app needs location permission to track delivery progress.',
            [{ text: 'OK' }]
          );
          return false;
        }

        if (!backgroundLocationGranted) {
          Alert.alert(
            'Background Location Permission',
            'For continuous tracking during delivery, please enable background location access in settings.',
            [{ text: 'OK' }]
          );
        }

        return fineLocationGranted || coarseLocationGranted;
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true; // iOS permissions are handled by the system
  }

  public async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      return new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          (position) => {
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
              altitude: position.coords.altitude || undefined,
              altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            };
            
            // Process the location with filtering and smoothing
            const processedLocation = this.processLocation(locationData);
            
            if (processedLocation.isFiltered) {
              console.warn('Location filtered:', processedLocation.filterReason);
              // Return the original location even if filtered for getCurrentLocation
              resolve(locationData);
            } else {
              // Return smoothed location if available
              const finalLocation: LocationData = {
                ...locationData,
                latitude: processedLocation.smoothedLatitude || locationData.latitude,
                longitude: processedLocation.smoothedLongitude || locationData.longitude,
              };
              resolve(finalLocation);
            }
          },
          (error) => {
            console.error('Get current location error:', error);
            reject(error);
          },
          this.config
        );
      });
    } catch (error) {
      console.error('Location service error:', error);
      return null;
    }
  }

  public startTracking(
    onLocationUpdate: (location: LocationData) => void,
    onError?: (error: any) => void
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
          resolve(false);
          return;
        }

        this.onLocationUpdate = onLocationUpdate;
        this.onError = onError;

        this.watchId = Geolocation.watchPosition(
          (position) => {
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
              altitude: position.coords.altitude || undefined,
              altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            };
            
            // Process the location with filtering and smoothing
            const processedLocation = this.processLocation(locationData);
            
            if (!processedLocation.isFiltered) {
              // Only update with non-filtered locations
              const finalLocation: LocationData = {
                ...locationData,
                latitude: processedLocation.smoothedLatitude || locationData.latitude,
                longitude: processedLocation.smoothedLongitude || locationData.longitude,
              };
              this.onLocationUpdate?.(finalLocation);
            } else {
              console.warn('Location filtered during tracking:', processedLocation.filterReason);
            }
          },
          (error) => {
            console.error('Location tracking error:', error);
            this.onError?.(error);
          },
          this.config
        );

        this.isTracking = true;
        resolve(true);
      } catch (error) {
        console.error('Start tracking error:', error);
        resolve(false);
      }
    });
  }

  public stopTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.onLocationUpdate = undefined;
    this.onError = undefined;
    
    // Reset filter states
    this.resetFilterStates();
  }

  /**
   * Reset all filter and smoothing states
   */
  public resetFilterStates(): void {
    this.kalmanState = {
      latitude: 0,
      longitude: 0,
      variance: 1000,
      initialized: false,
    };
    this.smoothedLocation = null;
    this.locationHistory = [];
  }

  public isLocationTracking(): boolean {
    return this.isTracking;
  }

  public updateConfig(newConfig: Partial<LocationServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): LocationServiceConfig {
    return { ...this.config };
  }
}

export default new LocationService();
