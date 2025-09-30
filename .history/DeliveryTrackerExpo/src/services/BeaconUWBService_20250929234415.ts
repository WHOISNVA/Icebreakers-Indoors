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
      
      const beaconData: BeaconData = {
        uuid: mockBeacon.uuid,
        major: mockBeacon.major,
        minor: mockBeacon.minor,
        rssi: mockBeacon.rssi,
        accuracy: mockBeacon.accuracy,
        proximity: mockBeacon.proximity,
        timestamp: Date.now(),
        isActive: true
      };

      this.processBeaconReading(beaconData);
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

  private async startBLEScanning(): Promise<void> {
    // Note: In a real implementation, this would use react-native-bluetooth-scan or similar
    console.log('BLE scanning started (mock implementation)');
    
    // Simulate beacon detections
    this.simulateBLEBeacons();
  }

  private async startUWBScanning(): Promise<void> {
    // Note: UWB requires native implementation and specialized hardware
    console.log('UWB scanning started (mock implementation)');
    
    // Simulate UWB readings
    this.simulateUWBReadings();
  }

  private simulateBLEBeacons(): void {
    // Simulate discovering beacons at different distances
    const beaconIds = Array.from(this.knownAnchors.keys()).filter(id => 
      this.knownAnchors.get(id)?.type === 'ibeacon'
    );

    setInterval(() => {
      if (!this.isActive) return;

      beaconIds.forEach((beaconId, index) => {
        // Simulate varying RSSI and distance
        const baseRSSI = -60;
        const noise = (Math.random() - 0.5) * 20; // ±10dB noise
        const rssi = baseRSSI + noise - (index * 10); // Different distances
        
        const distance = this.calculateDistanceFromRSSI(rssi, -59);
        
        const beacon = this.knownAnchors.get(beaconId)!;
        const reading: BeaconReading = {
          id: beaconId,
          uuid: beacon.uuid,
          major: beacon.major,
          minor: beacon.minor,
          rssi,
          distance,
          accuracy: Math.abs(noise) / 10, // Noise affects accuracy
          proximity: this.determineProximity(distance),
          timestamp: Date.now()
        };

        this.processBeaconReading(reading);
      });
    }, 1000); // Update every second
  }

  private simulateUWBReadings(): void {
    if (!this.config.enableUWB) return;

    const uwbIds = Array.from(this.knownAnchors.keys()).filter(id => 
      this.knownAnchors.get(id)?.type === 'uwb'
    );

    setInterval(() => {
      if (!this.isActive) return;

      uwbIds.forEach((anchorId, index) => {
        // UWB provides much more accurate distance measurements
        const baseDistance = 5 + index * 3; // Different distances
        const noise = (Math.random() - 0.5) * 0.2; // ±10cm noise
        const distance = baseDistance + noise;
        
        const reading: UWBReading = {
          anchorId,
          distance,
          accuracy: Math.abs(noise),
          angle: Math.random() * 360, // Random angle for simulation
          timestamp: Date.now()
        };

        this.processUWBReading(reading);
      });
    }, 500); // UWB updates faster than BLE
  }

  private processBeaconReading(reading: BeaconReading): void {
    // Apply RSSI filtering
    const filteredRSSI = this.filterRSSI(reading.id, reading.rssi);
    reading.rssi = filteredRSSI;
    reading.distance = this.calculateDistanceFromRSSI(filteredRSSI, -59);

    // Store reading
    if (!this.recentBeaconReadings.has(reading.id)) {
      this.recentBeaconReadings.set(reading.id, []);
    }
    
    const readings = this.recentBeaconReadings.get(reading.id)!;
    readings.push(reading);
    
    // Keep only recent readings
    const cutoffTime = Date.now() - this.config.maxBeaconAge!;
    this.recentBeaconReadings.set(
      reading.id,
      readings.filter(r => r.timestamp > cutoffTime)
    );

    this.config.onBeaconDetected?.(reading);
  }

  private processUWBReading(reading: UWBReading): void {
    // Store reading
    if (!this.recentUWBReadings.has(reading.anchorId)) {
      this.recentUWBReadings.set(reading.anchorId, []);
    }
    
    const readings = this.recentUWBReadings.get(reading.anchorId)!;
    readings.push(reading);
    
    // Keep only recent readings
    const cutoffTime = Date.now() - this.config.maxBeaconAge!;
    this.recentUWBReadings.set(
      reading.anchorId,
      readings.filter(r => r.timestamp > cutoffTime)
    );

    this.config.onUWBReading?.(reading);
  }

  private filterRSSI(beaconId: string, newRSSI: number): number {
    // Simple exponential moving average for RSSI smoothing
    const key = `rssi_${beaconId}`;
    const lastRSSI = (this as any)[key] || newRSSI;
    const alpha = this.config.rssiFilterAlpha!;
    
    const filteredRSSI = alpha * newRSSI + (1 - alpha) * lastRSSI;
    (this as any)[key] = filteredRSSI;
    
    return filteredRSSI;
  }

  private calculateDistanceFromRSSI(rssi: number, calibratedRSSI: number): number {
    // Distance calculation using RSSI
    // d = 10^((calibratedRSSI - rssi) / (10 * n))
    // where n is the path loss exponent (typically 2-4)
    const pathLossExponent = 2.5; // Environment-dependent
    const distance = Math.pow(10, (calibratedRSSI - rssi) / (10 * pathLossExponent));
    
    return Math.max(0.1, distance); // Minimum 10cm
  }

  private determineProximity(distance: number): 'immediate' | 'near' | 'far' | 'unknown' {
    if (distance < 0.5) return 'immediate';
    if (distance < 3.0) return 'near';
    if (distance < 10.0) return 'far';
    return 'unknown';
  }

  private performTriangulation(): void {
    // Collect recent distance measurements
    const distanceMeasurements: Array<{anchorId: string, distance: number, accuracy: number}> = [];

    // Add BLE beacon measurements
    for (const [beaconId, readings] of this.recentBeaconReadings) {
      if (readings.length > 0) {
        const recentReading = readings[readings.length - 1];
        distanceMeasurements.push({
          anchorId: beaconId,
          distance: recentReading.distance,
          accuracy: recentReading.accuracy
        });
      }
    }

    // Add UWB measurements (higher priority due to accuracy)
    for (const [anchorId, readings] of this.recentUWBReadings) {
      if (readings.length > 0) {
        const recentReading = readings[readings.length - 1];
        distanceMeasurements.push({
          anchorId,
          distance: recentReading.distance,
          accuracy: recentReading.accuracy
        });
      }
    }

    // Need at least 3 measurements for trilateration
    if (distanceMeasurements.length < this.config.minBeaconsForTrilateration!) {
      return;
    }

    // Perform trilateration
    const result = this.trilaterate(distanceMeasurements);
    if (result) {
      this.lastTriangulationResult = result;
      this.positionHistory.push(result);
      
      // Keep history limited
      if (this.positionHistory.length > 50) {
        this.positionHistory.shift();
      }

      this.config.onPositionUpdate?.(result);
    }
  }

  private trilaterate(measurements: Array<{anchorId: string, distance: number, accuracy: number}>): TriangulationResult | null {
    try {
      // Sort by accuracy (UWB first, then best BLE)
      measurements.sort((a, b) => a.accuracy - b.accuracy);
      
      // Take the best measurements
      const usedMeasurements = measurements.slice(0, Math.min(4, measurements.length));
      
      if (usedMeasurements.length < 3) return null;

      // Get anchor positions
      const anchors = usedMeasurements.map(m => {
        const anchor = this.knownAnchors.get(m.anchorId);
        if (!anchor) return null;
        return {
          position: anchor.position,
          distance: m.distance,
          weight: 1 / (m.accuracy + 0.1) // Higher weight for more accurate measurements
        };
      }).filter(a => a !== null);

      if (anchors.length < 3) return null;

      // Weighted least squares trilateration
      const position = this.weightedLeastSquares(anchors as any);
      
      // Calculate confidence based on residual error
      const residualError = this.calculateResidualError(position, anchors as any);
      const confidence = Math.max(0.1, Math.min(0.9, 1.0 / (1.0 + residualError)));

      return {
        position,
        confidence,
        usedAnchors: usedMeasurements.map(m => m.anchorId),
        residualError,
        method: 'weighted_average'
      };
    } catch (error) {
      console.error('Trilateration error:', error);
      return null;
    }
  }

  private weightedLeastSquares(anchors: Array<{position: Point3D, distance: number, weight: number}>): Point3D {
    // Simplified weighted centroid method
    // In a real implementation, this would use proper least squares optimization
    
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;

    for (const anchor of anchors) {
      const weight = anchor.weight;
      totalWeight += weight;
      weightedX += anchor.position.x * weight;
      weightedY += anchor.position.y * weight;
      weightedZ += anchor.position.z * weight;
    }

    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight,
      z: weightedZ / totalWeight,
      timestamp: Date.now()
    };
  }

  private calculateResidualError(position: Point3D, anchors: Array<{position: Point3D, distance: number, weight: number}>): number {
    let totalError = 0;
    
    for (const anchor of anchors) {
      const calculatedDistance = this.calculateDistance3D(position, anchor.position);
      const error = Math.abs(calculatedDistance - anchor.distance);
      totalError += error * anchor.weight;
    }

    return totalError / anchors.length;
  }

  private calculateDistance3D(point1: Point3D, point2: Point3D): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // QR marker positioning removed - phones act as beacons only
  // Position is determined through BLE/UWB trilateration and mesh network coordination

  getCurrentPosition(): TriangulationResult | null {
    return this.lastTriangulationResult;
  }

  getPositionHistory(): TriangulationResult[] {
    return [...this.positionHistory];
  }

  getKnownAnchors(): BeaconAnchor[] {
    return Array.from(this.knownAnchors.values());
  }

  getRecentBeaconReadings(): Map<string, BeaconReading[]> {
    return new Map(this.recentBeaconReadings);
  }

  // Get position source for fusion
  getPositionSource(): PositionSource | null {
    if (!this.lastTriangulationResult) return null;

    return {
      type: 'beacon',
      weight: this.lastTriangulationResult.confidence,
      accuracy: this.lastTriangulationResult.residualError,
      timestamp: this.lastTriangulationResult.position.timestamp
    };
  }

  isScanning(): boolean {
    return this.isActive;
  }
}

export default BeaconUWBService;
