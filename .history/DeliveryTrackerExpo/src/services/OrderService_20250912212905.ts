import * as Location from 'expo-location';
import { Order, OrderItem, GeoPoint } from '../types/order';

function generateId(prefix: string = 'ord'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

export class OrderService {
  private orders: Order[] = [];
  private listeners: Array<(orders: Order[]) => void> = [];
  private lastCreatedId: string | null = null;

  subscribe(listener: (orders: Order[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.orders);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l(this.orders);
  }

  async createOrder(items: OrderItem[], locationDescription?: string): Promise<Order> {
    // Request precise location for the order origin
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    const pos = await Location.getCurrentPositionAsync({
      // Highest precision available to improve indoor accuracy heuristics
      accuracy: Location.Accuracy.BestForNavigation,
      mayShowUserSettingsDialog: true,
    });

    const origin: GeoPoint = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
      altitude: pos.coords.altitude ?? null,
      altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
      heading: pos.coords.heading ?? null,
      speed: pos.coords.speed ?? null,
      timestamp: pos.timestamp,
    };

    const order: Order = {
      id: generateId(),
      items,
      createdAt: Date.now(),
      origin,
      status: 'pending',
      locationDescription,
    };

    this.orders = [order, ...this.orders];
    this.lastCreatedId = order.id;
    this.emit();
    return order;
  }

  async updateOrderLocation(id: string, locationDescription?: string): Promise<Order | null> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
    const point: GeoPoint = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
      altitude: pos.coords.altitude ?? null,
      altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
      heading: pos.coords.heading ?? null,
      speed: pos.coords.speed ?? null,
      timestamp: pos.timestamp,
    };

    let updated: Order | null = null;
    this.orders = this.orders.map(o => {
      if (o.id === id) {
        updated = { 
          ...o, 
          currentLocation: point,
          currentLocationDescription: locationDescription 
        };
        return updated;
      }
      return o;
    });
    this.emit();
    return updated;
  }

  updateStatus(id: string, status: Order['status']): void {
    this.orders = this.orders.map(o => (o.id === id ? { ...o, status } : o));
    this.emit();
  }

  getLastOrderId(): string | null {
    if (this.lastCreatedId) return this.lastCreatedId;
    return this.orders.length > 0 ? this.orders[0].id : null;
  }
}

export const orderService = new OrderService();

