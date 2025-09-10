export interface DeliveryStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'delivered' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  estimatedDeliveryTime?: Date;
  currentLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

