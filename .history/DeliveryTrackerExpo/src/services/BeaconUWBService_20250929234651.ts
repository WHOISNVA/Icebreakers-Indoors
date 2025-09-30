import { Platform, PermissionsAndroid } from 'react-native';
import { Point3D, PositionSource } from './Spatial3DService';
import * as Location from 'expo-location';
import ExpoGoCompatibilityService from './ExpoGoCompatibility';

// Beacon and UWB Types
export interface BeaconReading {
  id: string;
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  distance: number;
  accuracy: number;
  proximity: 'immediate' | 'near' | 'far' | 'unknown';
  timestamp: number;
}

export interface UWBReading {
  anchorId: string;
  distance: number;
  accuracy: number;
  angle?: number; // If supported
  timestamp: number;
}

export interface BeaconAnchor {
  id: string;
  uuid: string;
  major: number;
  minor: number;
  position: Point3D;
  txPower: number; // Transmission power in dBm
  calibratedRSSI: number; // RSSI at 1 meter
  type: 'ibeacon' | 'eddystone' | 'uwb';
}

export interface TriangulationResult {
  position: Point3D;
  confidence: number;
  usedAnchors: string[];
  residualError: number;
  method: 'trilateration' | 'least_squares' | 'weighted_average';
}

export interface BeaconUWBConfig {
  onPositionUpdate?: (result: TriangulationResult) => void;
  onBeaconDetected?: (beacon: BeaconReading) => void;
  onUWBReading?: (reading: UWBReading) => void;
  enableBLE?: boolean;
  enableUWB?: boolean;
  minBeaconsForTrilateration?: number;
  maxBeaconAge?: number; // milliseconds
  rssiFilterAlpha?: number; // RSSI smoothing factor
}

// Additional types for the refactored service
interface BeaconData extends BeaconReading {
  isActive: boolean;
}

interface UWBAnchor {
  id: string;
  position: Point3D;
  isActive: boolean;
}

interface IndoorPosition {
  position: Point3D;
  accuracy: number;
  source: 'beacon' | 'uwb' | 'hybrid';
  timestamp: number;
}

class BeaconUWBService {
  private static instance: BeaconUWBService;
  private beacons: Map<string, BeaconData> = new Map();
  private uwbAnchors: Map<string, UWBAnchor> = new Map();
  private isScanning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private positionUpdateCallback: ((position: IndoorPosition) => void) | null = null;
  private compatibility: ExpoGoCompatibilityService;
  private mockBeaconInterval: NodeJS.Timeout | null = null;

  static getInstance(): BeaconUWBService {
    if (!BeaconUWBService.instance) {
      BeaconUWBService.instance = new BeaconUWBService();
    }
    return BeaconUWBService.instance;
  }

  constructor() {
    this.compatibility = ExpoGoCompatibilityService.getInstance();
  }

  // === INITIALIZATION ===

  async initialize(): Promise<boolean> {
    try {
      // Check compatibility
      if (!this.compatibility.getStatus().bleBeaconSupported) {
        this.compatibility.logCompatibilityWarning('BLE beacon scanning');
        console.log('BLE beacon scanning will use mock data in Expo Go');
      }

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission denied');
        return false;
      }

      console.log('BeaconUWB Service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize BeaconUWB service:', error);
      return false;
    }
  }

  // === BEACON SCANNING ===

  startBeaconScanning(): void {
    if (this.isScanning) return;

    this.isScanning = true;
    console.log('Starting beacon scanning...');

    // In Expo Go, use mock beacons
    if (this.compatibility.isExpoGo()) {
      this.startMockBeaconScanning();
      return;
    }

    // Real beacon scanning would use native modules
    // For now, simulate beacon discovery
    this.scanInterval = setInterval(() => {
      this.simulateBeaconDiscovery();
    }, 1000);
  }

  private startMockBeaconScanning(): void {
    console.log('Using mock beacon data for Expo Go');
    
    this.mockBeaconInterval = setInterval(() => {
      // Generate mock beacon data
      const mockBeacon = this.compatibility.generateMockBeaconData();
      
      const beacon: BeaconData = {
        id: `${mockBeacon.uuid}-${mockBeacon.major}-${mockBeacon.minor}`,
        uuid: mockBeacon.uuid,
        major: mockBeacon.major,
        minor: mockBeacon.minor,
        rssi: mockBeacon.rssi,
        distance: mockBeacon.accuracy, // Use accuracy as distance estimate
        accuracy: mockBeacon.accuracy,
        proximity: mockBeacon.proximity,
        timestamp: Date.now(),
        isActive: true
      };

      this.processBeaconReading(beacon);
    }, 2000); // Update every 2 seconds
  }

  stopBeaconScanning(): void {
    if (!this.isScanning) return;

    this.isScanning = false;
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.mockBeaconInterval) {
      clearInterval(this.mockBeaconInterval);
      this.mockBeaconInterval = null;
    }

    console.log('Beacon scanning stopped');
  }

  private processBeaconReading(beacon: BeaconData): void {
    const beaconKey = `${beacon.uuid}-${beacon.major}-${beacon.minor}`;
    this.beacons.set(beaconKey, beacon);

    // Clean up old beacons
    const now = Date.now();
    for (const [key, b] of this.beacons.entries()) {
      if (now - b.timestamp > 10000) { // Remove beacons not seen for 10 seconds
        this.beacons.delete(key);
      }
    }

    // Attempt triangulation if we have enough beacons
    if (this.beacons.size >= 3) {
      this.performTriangulation();
    }
  }

  private simulateBeaconDiscovery(): void {
    // Simulate discovering known beacons with varying signal strengths
    const knownBeacons = [
      { uuid: 'beacon-001', major: 1, minor: 1, baseRssi: -60 },
      { uuid: 'beacon-002', major: 1, minor: 2, baseRssi: -65 },
      { uuid: 'beacon-003', major: 1, minor: 3, baseRssi: -70 },
    ];

    knownBeacons.forEach(kb => {
      const rssi = kb.baseRssi + (Math.random() * 10 - 5); // Add noise
      const distance = this.calculateDistance(rssi, -59); // -59 is typical TX power at 1m
      
      const beacon: BeaconData = {
        id: `${kb.uuid}-${kb.major}-${kb.minor}`,
        uuid: kb.uuid,
        major: kb.major,
        minor: kb.minor,
        rssi: rssi,
        distance: distance,
        accuracy: distance * 0.2, // 20% uncertainty
        proximity: this.getProximity(distance),
        timestamp: Date.now(),
        isActive: true
      };

      this.processBeaconReading(beacon);
    });
  }

  private calculateDistance(rssi: number, txPower: number): number {
    // Path loss formula: Distance = 10^((TX Power - RSSI) / (10 * n))
    // n = path loss exponent (typically 2 for free space)
    const n = 2.0;
    return Math.pow(10, (txPower - rssi) / (10 * n));
  }

  private getProximity(distance: number): 'immediate' | 'near' | 'far' | 'unknown' {
    if (distance < 0.5) return 'immediate';
    if (distance < 3) return 'near';
    if (distance < 10) return 'far';
    return 'unknown';
  }

  private performTriangulation(): void {
    const activeBeacons = Array.from(this.beacons.values())
      .filter(b => b.isActive && Date.now() - b.timestamp < 5000);

    if (activeBeacons.length < 3) return;

    // Simple weighted average based on signal strength
    // In production, use proper trilateration
    let weightedX = 0, weightedY = 0, totalWeight = 0;

    activeBeacons.forEach((beacon, index) => {
      // Mock positions for beacons (in production, these would be configured)
      const positions = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 }
      ];
      
      const pos = positions[index % positions.length];
      const weight = 1 / (beacon.distance * beacon.distance); // Inverse square weighting
      
      weightedX += pos.x * weight;
      weightedY += pos.y * weight;
      totalWeight += weight;
    });

    if (totalWeight > 0) {
      const position: IndoorPosition = {
        position: {
          x: weightedX / totalWeight,
          y: weightedY / totalWeight,
          z: 0,
          timestamp: Date.now()
        },
        accuracy: 2.0, // meters
        source: 'beacon',
        timestamp: Date.now()
      };

      if (this.positionUpdateCallback) {
        this.positionUpdateCallback(position);
      }
    }
  }

  // === PUBLIC API ===

  setPositionUpdateCallback(callback: (position: IndoorPosition) => void): void {
    this.positionUpdateCallback = callback;
  }

  getBeacons(): BeaconData[] {
    return Array.from(this.beacons.values());
  }

  getLastPosition(): IndoorPosition | null {
    // Would return the last calculated position
    return null;
  }

  isActive(): boolean {
    return this.isScanning;
  }
}

export default BeaconUWBService;
