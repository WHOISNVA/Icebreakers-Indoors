import * as Location from 'expo-location';
import { calculateDistance } from '../utils/locationUtils';

export interface DeliveryLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface DeliveryStatus {
  orderId: string;
  serverLocation: DeliveryLocation;
  customerLocation: DeliveryLocation;
  distanceToCustomer: number; // meters
  hasArrived: boolean;
  arrivedAt?: number; // timestamp
}

const ARRIVAL_THRESHOLD = 15; // meters - consider arrived if within 15m
const ARRIVAL_CONFIRMATION_TIME = 3000; // ms - stay within threshold for 3 seconds

class DeliveryTrackingService {
  private serverLocation: DeliveryLocation | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private deliveryStatuses: Map<string, DeliveryStatus> = new Map();
  private arrivalTimers: Map<string, NodeJS.Timeout> = new Map();
  private onArrivalCallbacks: Map<string, (orderId: string) => void> = new Map();

  /**
   * Start tracking server's location
   */
  public async startServerTracking(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission not granted');
        return false;
      }

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 5, // Or when moved 5 meters
        },
        (location) => {
          this.serverLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 0,
            timestamp: location.timestamp,
          };

          // Update all active deliveries
          this.updateAllDeliveries();
        }
      );

      return true;
    } catch (error) {
      console.error('Failed to start server tracking:', error);
      return false;
    }
  }

  /**
   * Stop tracking server's location
   */
  public stopServerTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    this.serverLocation = null;
    
    // Clear all timers
    this.arrivalTimers.forEach(timer => clearTimeout(timer));
    this.arrivalTimers.clear();
  }

  /**
   * Get current server location
   */
  public getServerLocation(): DeliveryLocation | null {
    return this.serverLocation;
  }

  /**
   * Track delivery to a customer location
   */
  public trackDelivery(
    orderId: string,
    customerLocation: { latitude: number; longitude: number },
    onArrival?: (orderId: string) => void
  ): void {
    const deliveryStatus: DeliveryStatus = {
      orderId,
      serverLocation: this.serverLocation!,
      customerLocation: {
        ...customerLocation,
        accuracy: 0,
        timestamp: Date.now(),
      },
      distanceToCustomer: 0,
      hasArrived: false,
    };

    this.deliveryStatuses.set(orderId, deliveryStatus);
    
    if (onArrival) {
      this.onArrivalCallbacks.set(orderId, onArrival);
    }

    this.updateDeliveryStatus(orderId);
  }

  /**
   * Stop tracking a specific delivery
   */
  public stopTrackingDelivery(orderId: string): void {
    this.deliveryStatuses.delete(orderId);
    this.onArrivalCallbacks.delete(orderId);
    
    const timer = this.arrivalTimers.get(orderId);
    if (timer) {
      clearTimeout(timer);
      this.arrivalTimers.delete(orderId);
    }
  }

  /**
   * Get delivery status
   */
  public getDeliveryStatus(orderId: string): DeliveryStatus | null {
    return this.deliveryStatuses.get(orderId) || null;
  }

  /**
   * Check if server has arrived at customer location
   */
  public hasArrivedAtLocation(orderId: string): boolean {
    const status = this.deliveryStatuses.get(orderId);
    return status?.hasArrived || false;
  }

  /**
   * Update all active deliveries
   */
  private updateAllDeliveries(): void {
    this.deliveryStatuses.forEach((_, orderId) => {
      this.updateDeliveryStatus(orderId);
    });
  }

  /**
   * Update delivery status for a specific order
   */
  private updateDeliveryStatus(orderId: string): void {
    const delivery = this.deliveryStatuses.get(orderId);
    if (!delivery || !this.serverLocation) {
      return;
    }

    // Calculate distance
    const distance = calculateDistance(
      this.serverLocation.latitude,
      this.serverLocation.longitude,
      delivery.customerLocation.latitude,
      delivery.customerLocation.longitude
    );

    // Update status
    delivery.serverLocation = this.serverLocation;
    delivery.distanceToCustomer = distance;

    // Check arrival
    if (distance <= ARRIVAL_THRESHOLD) {
      this.handlePotentialArrival(orderId, delivery);
    } else {
      // Not within threshold, cancel any pending arrival
      const timer = this.arrivalTimers.get(orderId);
      if (timer) {
        clearTimeout(timer);
        this.arrivalTimers.delete(orderId);
      }
      
      if (delivery.hasArrived) {
        // Left the location
        delivery.hasArrived = false;
        delivery.arrivedAt = undefined;
        console.log(`📍 Server left customer location for order ${orderId}`);
      }
    }

    this.deliveryStatuses.set(orderId, delivery);
  }

  /**
   * Handle potential arrival (must stay in threshold for confirmation time)
   */
  private handlePotentialArrival(orderId: string, delivery: DeliveryStatus): void {
    // Already arrived
    if (delivery.hasArrived) {
      return;
    }

    // Already has a pending arrival timer
    if (this.arrivalTimers.has(orderId)) {
      return;
    }

    // Set timer to confirm arrival
    console.log(`📍 Server approaching order ${orderId} - ${delivery.distanceToCustomer.toFixed(1)}m away`);
    
    const timer = setTimeout(() => {
      // Check if still within threshold
      const currentDelivery = this.deliveryStatuses.get(orderId);
      if (currentDelivery && currentDelivery.distanceToCustomer <= ARRIVAL_THRESHOLD) {
        currentDelivery.hasArrived = true;
        currentDelivery.arrivedAt = Date.now();
        this.deliveryStatuses.set(orderId, currentDelivery);
        
        console.log(`✅ Server ARRIVED at customer location for order ${orderId}`);
        
        // Call arrival callback
        const callback = this.onArrivalCallbacks.get(orderId);
        if (callback) {
          callback(orderId);
        }
      }
      
      this.arrivalTimers.delete(orderId);
    }, ARRIVAL_CONFIRMATION_TIME);

    this.arrivalTimers.set(orderId, timer);
  }

  /**
   * Manually mark as arrived (for testing or manual confirmation)
   */
  public markAsArrived(orderId: string): void {
    const delivery = this.deliveryStatuses.get(orderId);
    if (delivery) {
      delivery.hasArrived = true;
      delivery.arrivedAt = Date.now();
      this.deliveryStatuses.set(orderId, delivery);
      
      const callback = this.onArrivalCallbacks.get(orderId);
      if (callback) {
        callback(orderId);
      }
    }
  }

  /**
   * Get all active deliveries
   */
  public getActiveDeliveries(): DeliveryStatus[] {
    return Array.from(this.deliveryStatuses.values());
  }

  /**
   * Clean up
   */
  public cleanup(): void {
    this.stopServerTracking();
    this.deliveryStatuses.clear();
    this.onArrivalCallbacks.clear();
    this.arrivalTimers.forEach(timer => clearTimeout(timer));
    this.arrivalTimers.clear();
  }
}

export default new DeliveryTrackingService();



