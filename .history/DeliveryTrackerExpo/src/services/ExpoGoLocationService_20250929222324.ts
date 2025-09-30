import * as Location from 'expo-location';

// Types moved from deleted AdvancedLocationService
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

// Expo Go compatible location service with similar functionality
export class ExpoGoLocationService {
  private config: any;
  private isActive: boolean = false;
  private locationSubscription: any = null;
  private lastGoodLocation: GNSSReading | null = null;
  
  // Simple Kalman filter for Expo Go
  private kalmanState = {
    lat: 0,
    lng: 0,
    variance: 1000
  };
  
  // Location history for filtering
  private locationHistory: GNSSReading[] = [];
  private consecutiveBadReadings: number = 0;

  constructor(config: any = {}) {
    this.config = {
      maxAccuracyThreshold: 15,
      maxJumpDistance: 100,
      smoothingFactor: 0.3,
      minUpdateInterval: 500,
      ...config
    };
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async startContinuousTracking(): Promise<void> {
    if (this.isActive) return;

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Location permissions not granted');
    }

    this.isActive = true;

    // Use expo-location's watchPositionAsync for continuous tracking
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: this.config.minUpdateInterval,
        distanceInterval: 0, // Get all updates
      },
      (location) => {
        this.processLocationReading(this.convertToGNSSReading(location));
      }
    );

    console.log('Expo Go location tracking started');
  }

  async stopTracking(): Promise<void> {
    this.isActive = false;

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    this.locationHistory = [];
    this.lastGoodLocation = null;
    this.consecutiveBadReadings = 0;
    this.resetKalmanFilter();
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
    // Quality check
    if (reading.accuracy && reading.accuracy > this.config.maxAccuracyThreshold) {
      this.consecutiveBadReadings++;
      return;
    }

    // Jump detection
    if (this.detectLocationJump(reading)) {
      this.consecutiveBadReadings++;
      return;
    }

    this.consecutiveBadReadings = 0;

    // Add to history
    this.locationHistory.push(reading);
    if (this.locationHistory.length > 10) {
      this.locationHistory.shift();
    }

    // Apply Expo Go compatible filtering
    const filteredLocation = this.applyExpoGoFiltering(reading);
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

    const timeDiff = (reading.timestamp - this.lastGoodLocation.timestamp) / 1000;
    const maxPossibleDistance = timeDiff * 50; // 50 m/s max speed

    return distance > Math.max(this.config.maxJumpDistance, maxPossibleDistance);
  }

  private applyExpoGoFiltering(reading: GNSSReading): FilteredLocation {
    // Simple Kalman filter implementation for Expo Go
    const filtered = this.simpleKalmanFilter(reading);
    
    // Moving average for additional smoothing
    const smoothed = this.movingAverageFilter(filtered);

    // Calculate confidence
    let confidence = 0.5;
    if (reading.accuracy) {
      confidence = Math.max(0, 1 - (reading.accuracy / this.config.maxAccuracyThreshold));
    }

    // Boost confidence for consistent readings
    if (this.locationHistory.length >= 3) {
      confidence += 0.2;
    }

    return {
      location: smoothed,
      confidence: Math.min(1, confidence),
      source: 'filtered',
      jumpDetected: false
    };
  }

  private simpleKalmanFilter(reading: GNSSReading): GNSSReading {
    if (this.kalmanState.lat === 0) {
      // Initialize
      this.kalmanState.lat = reading.latitude;
      this.kalmanState.lng = reading.longitude;
      return reading;
    }

    // Process noise
    const Q = 0.001;
    // Measurement noise based on GPS accuracy
    const R = reading.accuracy ? Math.pow(reading.accuracy / 111000, 2) : 0.0001;

    // Predict
    this.kalmanState.variance += Q;

    // Update
    const gain = this.kalmanState.variance / (this.kalmanState.variance + R);
    
    this.kalmanState.lat += gain * (reading.latitude - this.kalmanState.lat);
    this.kalmanState.lng += gain * (reading.longitude - this.kalmanState.lng);
    this.kalmanState.variance = (1 - gain) * this.kalmanState.variance;

    return {
      ...reading,
      latitude: this.kalmanState.lat,
      longitude: this.kalmanState.lng
    };
  }

  private movingAverageFilter(reading: GNSSReading): GNSSReading {
    if (this.locationHistory.length < 2) {
      return reading;
    }

    // Weighted moving average
    const weights = [0.5, 0.3, 0.2]; // Current, previous, before previous
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;

    const recentHistory = [reading, ...this.locationHistory.slice(-2)];
    
    recentHistory.forEach((location, index) => {
      const weight = weights[index] || 0.1;
      totalWeight += weight;
      weightedLat += location.latitude * weight;
      weightedLng += location.longitude * weight;
    });

    return {
      ...reading,
      latitude: weightedLat / totalWeight,
      longitude: weightedLng / totalWeight
    };
  }

  private resetKalmanFilter(): void {
    this.kalmanState = {
      lat: 0,
      lng: 0,
      variance: 1000
    };
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

  getCurrentLocation(): GNSSReading | null {
    return this.lastGoodLocation;
  }

  isTracking(): boolean {
    return this.isActive;
  }

  getQualityMetrics() {
    return {
      totalReadings: this.locationHistory.length,
      goodReadings: this.locationHistory.length,
      qualityRatio: 1.0,
      consecutiveBadReadings: this.consecutiveBadReadings,
      historySize: this.locationHistory.length
    };
  }
}

export default ExpoGoLocationService;
