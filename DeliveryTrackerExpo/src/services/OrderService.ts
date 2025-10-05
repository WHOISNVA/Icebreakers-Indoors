import * as Location from 'expo-location';
import { ref, push, set, onValue, update, remove, DataSnapshot } from 'firebase/database';
import { database } from '../config/firebase';
import { Order, OrderItem, GeoPoint } from '../types/order';
import { estimateFloor, setBuildingBaseAltitude } from '../utils/locationUtils';
import IndoorAtlasService from './IndoorAtlasService';

function generateId(prefix: string = 'ord'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

export class OrderService {
  private listeners: Array<(orders: Order[]) => void> = [];
  private lastCreatedId: string | null = null;
  private ordersRef = ref(database, 'orders');

  subscribe(listener: (orders: Order[]) => void): () => void {
    this.listeners.push(listener);
    
    // Listen to Firebase changes
    const unsubscribe = onValue(this.ordersRef, (snapshot: DataSnapshot) => {
      const orders: Order[] = [];
      snapshot.forEach((childSnapshot) => {
        orders.push(childSnapshot.val());
      });
      // Sort by creation time (newest first)
      orders.sort((a, b) => b.createdAt - a.createdAt);
      listener(orders);
    });

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
      unsubscribe();
    };
  }

  async createOrder(items: OrderItem[]): Promise<Order> {
    // Use IndoorAtlas for precise indoor positioning (falls back to GPS automatically)
    const position = await IndoorAtlasService.getCurrentPosition();

    console.log(`📍 Position from ${position.source.toUpperCase()}: lat=${position.latitude}, lng=${position.longitude}, accuracy=${position.accuracy}m`);

    // Determine floor number
    let floorNumber: number | null = null;
    
    if (position.floor !== null) {
      // IndoorAtlas provides floor directly - most accurate!
      floorNumber = position.floor;
      console.log(`🏢 IndoorAtlas detected floor: ${floorNumber}`);
    } else if (position.altitude) {
      // GPS fallback - estimate from altitude
      setBuildingBaseAltitude(position.altitude);
      floorNumber = estimateFloor(position.altitude);
      console.log(`🏢 Auto-calibrated floor from altitude: ${floorNumber}`);
    }

    const origin: GeoPoint = {
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      altitude: position.altitude,
      altitudeAccuracy: null, // IndoorAtlas doesn't provide this
      floor: floorNumber,
      heading: position.heading,
      speed: null,
      timestamp: position.timestamp,
    };

    const order: Order = {
      id: generateId(),
      items,
      createdAt: Date.now(),
      origin,
      status: 'pending',
    };

    // Save to Firebase
    const orderRef = ref(database, `orders/${order.id}`);
    await set(orderRef, order);
    
    this.lastCreatedId = order.id;
    return order;
  }

  async updateOrderLocation(id: string, detailsNote?: string | null): Promise<Order | null> {
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
      floor: pos.coords.altitude ? estimateFloor(pos.coords.altitude) : null,
      heading: pos.coords.heading ?? null,
      speed: pos.coords.speed ?? null,
      timestamp: pos.timestamp,
    };

    // Update in Firebase
    const orderRef = ref(database, `orders/${id}`);
    const updates: Partial<Order> = {
      currentLocation: point,
    };
    if (detailsNote !== undefined) {
      updates.detailsNote = detailsNote;
    }
    
    await update(orderRef, updates);
    return null; // Firebase will trigger the listener
  }

  async updateStatus(id: string, status: Order['status']): Promise<void> {
    const orderRef = ref(database, `orders/${id}`);
    await update(orderRef, { status });
  }

  getLastOrderId(): string | null {
    return this.lastCreatedId;
  }
}

export const orderService = new OrderService();

