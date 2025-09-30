import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Three.js types for 3D venue modeling
interface Vector3D {
  x: number;
  y: number;
  z: number;
}

interface Zone3D {
  id: string;
  name: string;
  type: 'bar' | 'seating' | 'entrance' | 'restroom' | 'kitchen' | 'stage' | 'pool' | 'deck';
  vertices: Vector3D[]; // 3D polygon defining the zone
  center: Vector3D;
  floor: number;
  capacity?: number;
  amenities?: string[];
  color: string; // Hex color for 3D rendering
  isActive: boolean;
}

interface VenueModel3D {
  id: string;
  name: string;
  bounds: {
    min: Vector3D;
    max: Vector3D;
  };
  floors: Array<{
    level: number;
    height: number;
    zones: Zone3D[];
  }>;
  anchors: Array<{
    id: string;
    position: Vector3D;
    type: 'ble' | 'uwb' | 'wifi';
    range: number;
  }>;
  gpsReference: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  scale: number; // meters per unit
}

interface ARPositioning {
  position: Vector3D;
  orientation: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  confidence: number;
  timestamp: number;
  trackingState: 'tracking' | 'limited' | 'not_available';
}

interface ProximityAlert {
  userId: string;
  bartenderId: string;
  distance: number;
  threshold: number;
  alertType: 'approaching' | 'arrived' | 'departed';
  timestamp: number;
}

interface VenueManagementConfig {
  onZoneCreated?: (zone: Zone3D) => void;
  onZoneUpdated?: (zone: Zone3D) => void;
  onProximityAlert?: (alert: ProximityAlert) => void;
  onARTrackingChanged?: (state: ARPositioning) => void;
  proximityThreshold?: number; // meters
  enableHaptics?: boolean;
  enableAudio?: boolean;
}

class VenueManagementService {
  private static instance: VenueManagementService;
  private config: VenueManagementConfig;
  private currentVenue: VenueModel3D | null = null;
  private deviceUUID: string = '';
  private arSession: any = null;
  private proximityMonitor: NodeJS.Timeout | null = null;
  private connectedDevices: Map<string, {
    position: Vector3D;
    role: 'customer' | 'bartender';
    lastSeen: number;
    rssi?: number;
  }> = new Map();

  constructor(config: VenueManagementConfig = {}) {
    this.config = {
      proximityThreshold: 2.0, // 2 meters
      enableHaptics: true,
      enableAudio: true,
      ...config
    };

    this.initializeDevice();
  }

  static getInstance(config?: VenueManagementConfig): VenueManagementService {
    if (!VenueManagementService.instance) {
      VenueManagementService.instance = new VenueManagementService(config);
    }
    return VenueManagementService.instance;
  }

  private async initializeDevice(): Promise<void> {
    // Generate or retrieve device UUID for BLE beacon identification
    let uuid = await AsyncStorage.getItem('device_uuid');
    if (!uuid) {
      uuid = this.generateUUID();
      await AsyncStorage.setItem('device_uuid', uuid);
    }
    this.deviceUUID = uuid;
    console.log(`Device UUID: ${this.deviceUUID}`);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // === 3D VENUE MODELING ===

  async createVenue(name: string, gpsReference: { lat: number; lng: number; alt: number }): Promise<VenueModel3D> {
    const venue: VenueModel3D = {
      id: `venue_${Date.now()}`,
      name,
      bounds: {
        min: { x: -50, y: -50, z: 0 },
        max: { x: 50, y: 50, z: 20 }
      },
      floors: [
        {
          level: 1,
          height: 3.5,
          zones: []
        }
      ],
      anchors: [],
      gpsReference: {
        latitude: gpsReference.lat,
        longitude: gpsReference.lng,
        altitude: gpsReference.alt
      },
      scale: 1.0 // 1 unit = 1 meter
    };

    this.currentVenue = venue;
    await this.saveVenue(venue);
    return venue;
  }

  async addZone(zone: Omit<Zone3D, 'id' | 'center'>): Promise<Zone3D> {
    if (!this.currentVenue) throw new Error('No venue loaded');

    const newZone: Zone3D = {
      ...zone,
      id: `zone_${Date.now()}`,
      center: this.calculatePolygonCenter(zone.vertices)
    };

    const floor = this.currentVenue.floors.find(f => f.level === zone.floor);
    if (!floor) throw new Error(`Floor ${zone.floor} not found`);

    floor.zones.push(newZone);
    await this.saveVenue(this.currentVenue);
    
    this.config.onZoneCreated?.(newZone);
    console.log(`Zone created: ${newZone.name} on floor ${newZone.floor}`);
    
    return newZone;
  }

  async updateZone(zoneId: string, updates: Partial<Zone3D>): Promise<Zone3D | null> {
    if (!this.currentVenue) return null;

    for (const floor of this.currentVenue.floors) {
      const zoneIndex = floor.zones.findIndex(z => z.id === zoneId);
      if (zoneIndex !== -1) {
        const zone = floor.zones[zoneIndex];
        Object.assign(zone, updates);
        
        // Recalculate center if vertices changed
        if (updates.vertices) {
          zone.center = this.calculatePolygonCenter(updates.vertices);
        }

        await this.saveVenue(this.currentVenue);
        this.config.onZoneUpdated?.(zone);
        return zone;
      }
    }
    return null;
  }

  private calculatePolygonCenter(vertices: Vector3D[]): Vector3D {
    const center = vertices.reduce(
      (acc, vertex) => ({
        x: acc.x + vertex.x,
        y: acc.y + vertex.y,
        z: acc.z + vertex.z
      }),
      { x: 0, y: 0, z: 0 }
    );

    return {
      x: center.x / vertices.length,
      y: center.y / vertices.length,
      z: center.z / vertices.length
    };
  }

  // === AR POSITIONING SYSTEM ===

  async startARSession(): Promise<boolean> {
    try {
      // Initialize ARKit/ARCore session
      console.log('Starting AR session for indoor positioning...');
      
      // Simulated AR session initialization
      this.arSession = {
        isTracking: true,
        trackingState: 'tracking',
        worldOrigin: { x: 0, y: 0, z: 0 }
      };

      // Start AR tracking loop
      this.startARTracking();
      return true;
    } catch (error) {
      console.error('Failed to start AR session:', error);
      return false;
    }
  }

  private startARTracking(): void {
    const trackingInterval = setInterval(() => {
      if (!this.arSession?.isTracking) {
        clearInterval(trackingInterval);
        return;
      }

      // Simulate AR tracking data (in real implementation, this comes from ARKit/ARCore)
      const arPosition: ARPositioning = {
        position: {
          x: Math.random() * 10 - 5, // ±5 meters
          y: Math.random() * 10 - 5,
          z: 1.7 // Average person height
        },
        orientation: {
          pitch: (Math.random() - 0.5) * 20, // ±10 degrees
          yaw: Math.random() * 360,
          roll: (Math.random() - 0.5) * 10
        },
        confidence: 0.8 + Math.random() * 0.2, // 80-100%
        timestamp: Date.now(),
        trackingState: 'tracking'
      };

      this.config.onARTrackingChanged?.(arPosition);
      this.updateDevicePosition(this.deviceUUID, arPosition.position, 'customer');
    }, 100); // 10 FPS tracking
  }

  async stopARSession(): Promise<void> {
    if (this.arSession) {
      this.arSession.isTracking = false;
      this.arSession = null;
      console.log('AR session stopped');
    }
  }

  // === BLE BEACON / UWB POSITIONING ===

  async startBeaconScanning(): Promise<void> {
    console.log(`Starting BLE beacon scanning with UUID: ${this.deviceUUID}`);
    
    // Simulate beacon scanning and ranging
    const scanInterval = setInterval(() => {
      // Simulate discovering other devices
      this.simulateBeaconDiscovery();
    }, 2000); // Scan every 2 seconds

    // Store interval for cleanup
    (this as any).beaconScanInterval = scanInterval;
  }

  private simulateBeaconDiscovery(): void {
    // Simulate finding other devices (bartenders/customers)
    const nearbyDevices = [
      {
        uuid: 'bartender_001',
        position: { x: 5, y: 3, z: 1.7 },
        role: 'bartender' as const,
        rssi: -45 // Strong signal
      },
      {
        uuid: 'customer_002',
        position: { x: -2, y: 8, z: 1.7 },
        role: 'customer' as const,
        rssi: -65 // Moderate signal
      }
    ];

    nearbyDevices.forEach(device => {
      this.updateDevicePosition(device.uuid, device.position, device.role);
      this.connectedDevices.set(device.uuid, {
        position: device.position,
        role: device.role,
        lastSeen: Date.now(),
        rssi: device.rssi
      });
    });
  }

  private updateDevicePosition(deviceId: string, position: Vector3D, role: 'customer' | 'bartender'): void {
    const device = this.connectedDevices.get(deviceId);
    if (device) {
      device.position = position;
      device.lastSeen = Date.now();
    } else {
      this.connectedDevices.set(deviceId, {
        position,
        role,
        lastSeen: Date.now()
      });
    }

    // Check proximity to other devices
    this.checkProximity(deviceId);
  }

  // === PROXIMITY DETECTION & ALERTS ===

  private checkProximity(deviceId: string): void {
    const device = this.connectedDevices.get(deviceId);
    if (!device) return;

    // Check distance to all other devices
    for (const [otherId, otherDevice] of this.connectedDevices) {
      if (otherId === deviceId) continue;

      const distance = this.calculateDistance3D(device.position, otherDevice.position);
      
      // Alert if bartender approaches customer
      if (device.role === 'bartender' && otherDevice.role === 'customer' && 
          distance <= (this.config.proximityThreshold || 2.0)) {
        
        this.triggerProximityAlert({
          userId: otherId,
          bartenderId: deviceId,
          distance,
          threshold: this.config.proximityThreshold || 2.0,
          alertType: 'arrived',
          timestamp: Date.now()
        });
      }
    }
  }

  private calculateDistance3D(pos1: Vector3D, pos2: Vector3D): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private async triggerProximityAlert(alert: ProximityAlert): Promise<void> {
    console.log(`Proximity alert: Bartender ${alert.bartenderId} arrived at customer ${alert.userId} (${alert.distance.toFixed(1)}m)`);

    // Trigger haptic feedback on bartender's device
    if (this.config.enableHaptics && alert.bartenderId === this.deviceUUID) {
      await this.triggerHapticFeedback('success');
    }

    // Light up and play sound on customer's device
    if (alert.userId === this.deviceUUID) {
      await this.triggerCustomerAlert();
    }

    this.config.onProximityAlert?.(alert);
  }

  private async triggerHapticFeedback(type: 'success' | 'warning' | 'error'): Promise<void> {
    try {
      switch (type) {
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch (error) {
      console.error('Haptic feedback failed:', error);
    }
  }

  private async triggerCustomerAlert(): Promise<void> {
    try {
      // Play notification sound
      if (this.config.enableAudio) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
          { shouldPlay: true, volume: 0.8 }
        );
        await sound.playAsync();
      }

      // Trigger haptic pattern for customer
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 400);

      console.log('Customer alert triggered: Your bartender has arrived!');
    } catch (error) {
      console.error('Customer alert failed:', error);
    }
  }

  // === VENUE DATA MANAGEMENT ===

  private async saveVenue(venue: VenueModel3D): Promise<void> {
    try {
      await AsyncStorage.setItem(`venue_${venue.id}`, JSON.stringify(venue));
      console.log(`Venue saved: ${venue.name}`);
    } catch (error) {
      console.error('Failed to save venue:', error);
    }
  }

  async loadVenue(venueId: string): Promise<VenueModel3D | null> {
    try {
      const venueData = await AsyncStorage.getItem(`venue_${venueId}`);
      if (venueData) {
        this.currentVenue = JSON.parse(venueData);
        console.log(`Venue loaded: ${this.currentVenue?.name}`);
        return this.currentVenue;
      }
    } catch (error) {
      console.error('Failed to load venue:', error);
    }
    return null;
  }

  // === GETTERS ===

  getCurrentVenue(): VenueModel3D | null {
    return this.currentVenue;
  }

  getConnectedDevices(): Map<string, any> {
    return this.connectedDevices;
  }

  getDeviceUUID(): string {
    return this.deviceUUID;
  }

  getZoneByPosition(position: Vector3D, floor: number): Zone3D | null {
    if (!this.currentVenue) return null;

    const floorData = this.currentVenue.floors.find(f => f.level === floor);
    if (!floorData) return null;

    // Check if position is inside any zone polygon
    for (const zone of floorData.zones) {
      if (this.isPointInPolygon(position, zone.vertices)) {
        return zone;
      }
    }
    return null;
  }

  private isPointInPolygon(point: Vector3D, vertices: Vector3D[]): boolean {
    // Ray casting algorithm for 2D polygon (using x,y coordinates)
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      if (((vertices[i].y > point.y) !== (vertices[j].y > point.y)) &&
          (point.x < (vertices[j].x - vertices[i].x) * (point.y - vertices[i].y) / (vertices[j].y - vertices[i].y) + vertices[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // === CLEANUP ===

  async cleanup(): Promise<void> {
    await this.stopARSession();
    
    if ((this as any).beaconScanInterval) {
      clearInterval((this as any).beaconScanInterval);
    }

    if (this.proximityMonitor) {
      clearTimeout(this.proximityMonitor);
    }

    this.connectedDevices.clear();
    console.log('VenueManagementService cleaned up');
  }
}

export default VenueManagementService;
export type { 
  VenueModel3D, 
  Zone3D, 
  Vector3D, 
  ARPositioning, 
  ProximityAlert, 
  VenueManagementConfig 
};
