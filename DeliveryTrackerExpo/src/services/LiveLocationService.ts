import { database } from '../config/firebase';
import { ref, set, onValue, off, remove } from 'firebase/database';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';

export interface LiveLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  userId: string;
  orderId: string;
  isActive: boolean;
  lastUpdated: number;
  batteryLevel?: number;
  deviceInfo?: {
    platform: string;
    version: string;
  };
}

export interface LiveLocationSubscription {
  orderId: string;
  onLocationUpdate: (location: LiveLocationData) => void;
  onError: (error: any) => void;
}

class LiveLocationService {
  private subscriptions: Map<string, LiveLocationSubscription> = new Map();
  private isSharing: boolean = false;
  private currentOrderId: string | null = null;
  private currentUserId: string | null = null;

  /**
   * Start sharing live location for an order
   */
  public async startSharing(orderId: string, userId: string): Promise<boolean> {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission not granted');
        return false;
      }

      // Request background location permissions for continuous tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted - location updates may be limited');
      }

      this.isSharing = true;
      this.currentOrderId = orderId;
      this.currentUserId = userId;

      return true;
    } catch (error) {
      console.error('Failed to start location sharing:', error);
      return false;
    }
  }

  /**
   * Stop sharing live location
   */
  public async stopSharing(): Promise<void> {
    if (!this.currentOrderId) {
      return;
    }

    try {
      // Mark location as inactive in Firebase
      const locationRef = ref(database, `liveLocations/${this.currentOrderId}`);
      await set(locationRef, {
        isActive: false,
        lastUpdated: Date.now(),
      });

      // Remove the location after a delay
      setTimeout(async () => {
        try {
          await remove(locationRef);
        } catch (error) {
          console.error('Failed to remove live location:', error);
        }
      }, 5000);
    } catch (error) {
      console.error('Failed to stop location sharing:', error);
    }

    this.isSharing = false;
    this.currentOrderId = null;
    this.currentUserId = null;
  }

  /**
   * Update the current location
   */
  public async updateLocation(location: Location.LocationObject | LiveLocationData): Promise<void> {
    if (!this.currentOrderId || !this.isSharing) {
      return;
    }

    try {
      let batteryLevel: number | undefined;
      try {
        batteryLevel = await Battery.getBatteryLevelAsync();
      } catch (e) {
        console.warn('Could not get battery level:', e);
      }

      const liveLocation: LiveLocationData = {
        latitude: 'coords' in location ? location.coords.latitude : location.latitude,
        longitude: 'coords' in location ? location.coords.longitude : location.longitude,
        accuracy: 'coords' in location ? (location.coords.accuracy ?? 0) : location.accuracy,
        timestamp: 'coords' in location ? location.timestamp : location.timestamp,
        speed: 'coords' in location ? (location.coords.speed ?? undefined) : location.speed,
        heading: 'coords' in location ? (location.coords.heading ?? undefined) : location.heading,
        altitude: 'coords' in location ? (location.coords.altitude ?? undefined) : location.altitude,
        altitudeAccuracy: 'coords' in location ? (location.coords.altitudeAccuracy ?? undefined) : location.altitudeAccuracy,
        userId: this.currentUserId!,
        orderId: this.currentOrderId,
        isActive: true,
        lastUpdated: Date.now(),
        batteryLevel,
        deviceInfo: {
          platform: 'Expo',
          version: '1.0.0',
        },
      };

      const locationRef = ref(database, `liveLocations/${this.currentOrderId}`);
      await set(locationRef, liveLocation);
    } catch (error) {
      console.error('Failed to update live location:', error);
      throw error;
    }
  }

  /**
   * Subscribe to live location updates for an order
   */
  public subscribeToLiveLocation(
    orderId: string,
    onLocationUpdate: (location: LiveLocationData) => void,
    onError: (error: any) => void
  ): void {
    try {
      const locationRef = ref(database, `liveLocations/${orderId}`);
      
      const subscription: LiveLocationSubscription = {
        orderId,
        onLocationUpdate,
        onError,
      };

      this.subscriptions.set(orderId, subscription);

      onValue(locationRef, (snapshot) => {
        if (snapshot.exists()) {
          const locationData = snapshot.val() as LiveLocationData;
          if (locationData.isActive) {
            onLocationUpdate(locationData);
          }
        }
      }, (error) => {
        console.error('Live location subscription error:', error);
        onError(error);
      });
    } catch (error) {
      console.error('Failed to subscribe to live location:', error);
      onError(error);
    }
  }

  /**
   * Unsubscribe from live location updates
   */
  public unsubscribeFromLiveLocation(orderId: string): void {
    const subscription = this.subscriptions.get(orderId);
    if (subscription) {
      const locationRef = ref(database, `liveLocations/${orderId}`);
      off(locationRef);
      this.subscriptions.delete(orderId);
    }
  }

  /**
   * Check if currently sharing location
   */
  public isCurrentlySharing(): boolean {
    return this.isSharing;
  }

  /**
   * Get current order ID
   */
  public getCurrentOrderId(): string | null {
    return this.currentOrderId;
  }

  /**
   * Clean up all subscriptions
   */
  public cleanup(): void {
    this.subscriptions.forEach((subscription, orderId) => {
      this.unsubscribeFromLiveLocation(orderId);
    });
    this.subscriptions.clear();
    this.stopSharing();
  }
}

export default new LiveLocationService();

