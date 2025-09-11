export type UserRole = 'bar' | 'user';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  createdAt: number;
  origin: GeoPoint;
  currentLocation?: GeoPoint | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

