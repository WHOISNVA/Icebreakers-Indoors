export type UserRole = 'bar' | 'user';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  floor?: number | null; // Estimated floor number (0 = ground, 1 = first floor, etc.)
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
  detailsNote?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

