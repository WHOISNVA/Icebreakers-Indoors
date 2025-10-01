import { database } from '../config/firebase';
import { ref, set, onValue, off, remove, update } from 'firebase/database';
import { LocationData } from './LocationService';

export interface LiveLocationData extends LocationData {
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
  private shareInterval: NodeJS.Timeout | null = null;

  /**
   * Start sharing live location for an order
   */
  public async startSharing(
    userId: string,
    orderId: string,
    location: LocationData,
    updateInterval: number = 5000 // 5 seconds
  ): Promise<boolean> {
    try {
      this.currentUserId = userId;
      this.currentOrderId = orderId;
      this.isSharing = true;

      // Initial location update
      await this.updateLocation(location);

      // Set up periodic updates
      this.shareInterval = setInterval(async () => {
        if (this.isSharing && this.currentOrderId) {
          // This would typically get the current location from LocationService
          // For now, we'll just update the timestamp
          const liveLocation: LiveLocationData = {
            ...location,
            userId,
            orderId,
            isActive: true,
            lastUpdated: Date.now(),
            batteryLevel: this.getBatteryLevel(),
            deviceInfo: {
              platform: 'React Native',
              version: '1.0.0',
            },
          };

          await this.updateLocation(liveLocation);
        }
      }, updateInterval);

      return true;
    } catch (error) {
      console.error('Failed to start live location sharing:', error);
      return false;
    }
  }

  /**
   * Stop sharing live location
   */
  public async stopSharing(): Promise<void> {
    if (this.shareInterval) {
      clearInterval(this.shareInterval);
      this.shareInterval = null;
    }

    if (this.currentOrderId && this.currentUserId) {
      try {
        // Mark location as inactive
        const locationRef = ref(database, `liveLocations/${this.currentOrderId}`);
        await update(locationRef, {
          isActive: false,
          lastUpdated: Date.now(),
        });

        // Remove the location after a delay to allow for final updates
        setTimeout(async () => {
          try {
            await remove(locationRef);
          } catch (error) {
            console.error('Failed to remove live location:', error);
          }
        }, 30000); // 30 seconds delay
      } catch (error) {
        console.error('Failed to stop live location sharing:', error);
      }
    }

    this.isSharing = false;
    this.currentOrderId = null;
    this.currentUserId = null;
  }

  /**
   * Update the current location
   */
  public async updateLocation(location: LocationData | LiveLocationData): Promise<void> {
    if (!this.currentOrderId || !this.isSharing) {
      return;
    }

    try {
      const liveLocation: LiveLocationData = {
        ...location,
        userId: this.currentUserId!,
        orderId: this.currentOrderId,
        isActive: true,
        lastUpdated: Date.now(),
        batteryLevel: this.getBatteryLevel(),
        deviceInfo: {
          platform: 'React Native',
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
   * Get current live location for an order
   */
  public async getCurrentLiveLocation(orderId: string): Promise<LiveLocationData | null> {
    try {
      const locationRef = ref(database, `liveLocations/${orderId}`);
      
      return new Promise((resolve, reject) => {
        onValue(locationRef, (snapshot) => {
          if (snapshot.exists()) {
            const locationData = snapshot.val() as LiveLocationData;
            resolve(locationData.isActive ? locationData : null);
          } else {
            resolve(null);
          }
        }, (error) => {
          reject(error);
        }, { onlyOnce: true });
      });
    } catch (error) {
      console.error('Failed to get current live location:', error);
      return null;
    }
  }

  /**
   * Check if location is being shared for an order
   */
  public isSharingLocation(): boolean {
    return this.isSharing;
  }

  /**
   * Get current order ID being tracked
   */
  public getCurrentOrderId(): string | null {
    return this.currentOrderId;
  }

  /**
   * Get battery level (mock implementation)
   */
  private getBatteryLevel(): number {
    // In a real implementation, you would get this from the device
    // For now, return a mock value
    return Math.random() * 100;
  }

  /**
   * Clean up all subscriptions
   */
  public cleanup(): void {
    this.subscriptions.forEach((subscription, orderId) => {
      this.unsubscribeFromLiveLocation(orderId);
    });
    this.subscriptions.clear();
    
    if (this.shareInterval) {
      clearInterval(this.shareInterval);
      this.shareInterval = null;
    }
  }
}

export default new LiveLocationService();






