import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { LOCATION_CONFIG } from '../config/maps';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
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
  };

  private onLocationUpdate?: (location: LocationData) => void;
  private onError?: (error: any) => void;

  constructor() {
    this.requestPermissions();
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
            };
            resolve(locationData);
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
            };
            this.onLocationUpdate?.(locationData);
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
