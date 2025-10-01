import { database } from '../config/firebase';
import { ref, set, onValue, off, remove } from 'firebase/database';
import { Vibration, Alert, Platform } from 'react-native';

export interface PingData {
  orderId: string;
  fromUserId: string;
  toUserId: string;
  timestamp: number;
  message?: string;
  isActive: boolean;
}

export interface PingSubscription {
  orderId: string;
  onPingReceived: (ping: PingData) => void;
  onError: (error: any) => void;
}

class PingService {
  private subscriptions: Map<string, PingSubscription> = new Map();
  private currentUserId: string | null = null;

  /**
   * Set the current user ID for ping operations
   */
  public setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Send a ping to a user for a specific order
   */
  public async sendPing(
    orderId: string,
    toUserId: string,
    message?: string
  ): Promise<boolean> {
    if (!this.currentUserId) {
      console.error('Current user ID not set');
      return false;
    }

    try {
      const pingData: PingData = {
        orderId,
        fromUserId: this.currentUserId,
        toUserId,
        timestamp: Date.now(),
        message: message || 'Your order is ready!',
        isActive: true,
      };

      const pingRef = ref(database, `pings/${orderId}`);
      await set(pingRef, pingData);

      // Auto-remove ping after 30 seconds
      setTimeout(async () => {
        try {
          await remove(pingRef);
        } catch (error) {
          console.error('Failed to remove ping:', error);
        }
      }, 30000);

      return true;
    } catch (error) {
      console.error('Failed to send ping:', error);
      return false;
    }
  }

  /**
   * Subscribe to ping notifications for an order
   */
  public subscribeToPings(
    orderId: string,
    onPingReceived: (ping: PingData) => void,
    onError: (error: any) => void
  ): void {
    try {
      const pingRef = ref(database, `pings/${orderId}`);
      
      const subscription: PingSubscription = {
        orderId,
        onPingReceived,
        onError,
      };

      this.subscriptions.set(orderId, subscription);

      onValue(pingRef, (snapshot) => {
        if (snapshot.exists()) {
          const pingData = snapshot.val() as PingData;
          if (pingData.isActive && pingData.toUserId === this.currentUserId) {
            // Trigger device notification
            this.triggerPingNotification(pingData);
            onPingReceived(pingData);
          }
        }
      }, (error) => {
        console.error('Ping subscription error:', error);
        onError(error);
      });
    } catch (error) {
      console.error('Failed to subscribe to pings:', error);
      onError(error);
    }
  }

  /**
   * Unsubscribe from ping notifications
   */
  public unsubscribeFromPings(orderId: string): void {
    const subscription = this.subscriptions.get(orderId);
    if (subscription) {
      const pingRef = ref(database, `pings/${orderId}`);
      off(pingRef);
      this.subscriptions.delete(orderId);
    }
  }

  /**
   * Trigger ping notification on the device
   */
  private triggerPingNotification(ping: PingData): void {
    // Vibrate the device
    if (Platform.OS === 'ios') {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    } else {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    }

    // Show alert
    Alert.alert(
      '🔔 Order Ready!',
      `${ping.message}\n\nYour order is ready for pickup!`,
      [
        {
          text: 'OK',
          onPress: () => {
            console.log('Ping acknowledged');
          },
        },
      ],
      { cancelable: false }
    );

    console.log('Ping notification triggered:', ping);
  }

  /**
   * Check if there are active pings for an order
   */
  public async checkActivePings(orderId: string): Promise<PingData | null> {
    try {
      const pingRef = ref(database, `pings/${orderId}`);
      
      return new Promise((resolve, reject) => {
        onValue(pingRef, (snapshot) => {
          if (snapshot.exists()) {
            const pingData = snapshot.val() as PingData;
            resolve(pingData.isActive ? pingData : null);
          } else {
            resolve(null);
          }
        }, (error) => {
          reject(error);
        }, { onlyOnce: true });
      });
    } catch (error) {
      console.error('Failed to check active pings:', error);
      return null;
    }
  }

  /**
   * Clean up all subscriptions
   */
  public cleanup(): void {
    this.subscriptions.forEach((subscription, orderId) => {
      this.unsubscribeFromPings(orderId);
    });
    this.subscriptions.clear();
  }
}

export default new PingService();

