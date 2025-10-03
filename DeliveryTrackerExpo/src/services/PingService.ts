import { database } from '../config/firebase';
import { ref, set, onValue, off, remove } from 'firebase/database';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

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
  private sound: Audio.Sound | null = null;
  private audioInitialized: boolean = false;

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
   * Initialize audio for notifications
   */
  private async initializeAudio(): Promise<void> {
    if (this.audioInitialized) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      this.audioInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  /**
   * Play notification - SUPER STRONG haptic pattern (iOS Taptic Engine)
   * This creates an unmistakable notification pattern
   */
  private async playNotificationSound(): Promise<void> {
    try {
      console.log('🔔 Playing STRONG notification pattern...');
      
      // Ultra-strong 5-burst pattern
      // Each burst has 3 different haptic types for maximum effect
      for (let burst = 0; burst < 5; burst++) {
        // Triple-tap haptic burst
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await new Promise(resolve => setTimeout(resolve, 80));
        
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await new Promise(resolve => setTimeout(resolve, 80));
        
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        
        // Pause between bursts
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      console.log('✅ Notification pattern completed');
    } catch (error) {
      console.error('Failed to play notification:', error);
      // Fallback to basic haptics
      await this.triggerHapticFeedback();
    }
  }

  /**
   * Trigger haptic feedback - STRONG pattern
   */
  private async triggerHapticFeedback(): Promise<void> {
    try {
      // iOS STRONG warning pattern (more noticeable)
      for (let i = 0; i < 4; i++) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('Failed to trigger haptic feedback:', error);
    }
  }

  /**
   * Trigger ping notification on the device
   */
  private async triggerPingNotification(ping: PingData): Promise<void> {
    console.log('🔔 Ping notification triggered:', ping);

    // Play sound with haptics
    await this.playNotificationSound();

    // Show alert
    Alert.alert(
      '🔔 Order Ready!',
      `${ping.message}\n\nYour order is ready for pickup!`,
      [
        {
          text: 'Got it!',
          onPress: () => {
            console.log('Ping acknowledged by user');
          },
        },
      ],
      { cancelable: false }
    );
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
  public async cleanup(): Promise<void> {
    this.subscriptions.forEach((subscription, orderId) => {
      this.unsubscribeFromPings(orderId);
    });
    this.subscriptions.clear();

    // Clean up audio
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        console.error('Failed to unload sound:', error);
      }
      this.sound = null;
    }
  }
}

export default new PingService();

