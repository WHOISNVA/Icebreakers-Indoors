import { Point3D } from './Spatial3DService';
import { TriangulationResult, BeaconAnchor } from './BeaconUWBService';

// Expo Go compatible beacon service using WiFi RSSI and proximity estimation
export class ExpoGoBeaconService {
  private config: any;
  private isActive: boolean = false;
  
  // Simulated beacons using phone-to-phone proximity
  private knownAnchors: Map<string, BeaconAnchor> = new Map();
  private simulatedReadings: Map<string, any[]> = new Map();
  private lastTriangulationResult: TriangulationResult | null = null;
  private proximityInterval: any = null;

  constructor(config: any = {}) {
    this.config = {
      onPositionUpdate: config.onPositionUpdate,
      onBeaconDetected: config.onBeaconDetected,
      minBeaconsForTrilateration: 3,
      maxBeaconAge: 5000,
      ...config
    };

    this.initializeSimulatedAnchors();
  }

  private initializeSimulatedAnchors(): void {
    // Create simulated beacon anchors for Expo Go
    const anchors: BeaconAnchor[] = [
      {
        id: 'expo_bar_main',
        uuid: 'EXPO-BAR-MAIN-UUID',
        major: 1,
        minor: 1,
        position: { x: 0, y: 0, z: 2.5, timestamp: Date.now() },
        txPower: -59,
        calibratedRSSI: -59,
        type: 'ibeacon'
      },
      {
        id: 'expo_bar_side',
        uuid: 'EXPO-BAR-SIDE-UUID',
        major: 1,
        minor: 2,
        position: { x: 20, y: 0, z: 2.5, timestamp: Date.now() },
        txPower: -59,
        calibratedRSSI: -59,
        type: 'ibeacon'
      },
      {
        id: 'expo_seating_north',
        uuid: 'EXPO-SEATING-NORTH-UUID',
        major: 1,
        minor: 3,
        position: { x: -15, y: -30, z: 2.5, timestamp: Date.now() },
        txPower: -59,
        calibratedRSSI: -59,
        type: 'ibeacon'
      },
      {
        id: 'expo_seating_south',
        uuid: 'EXPO-SEATING-SOUTH-UUID',
        major: 1,
        minor: 4,
        position: { x: 15, y: -50, z: 2.5, timestamp: Date.now() },
        txPower: -59,
        calibratedRSSI: -59,
        type: 'ibeacon'
      }
    ];

    anchors.forEach(anchor => {
      this.knownAnchors.set(anchor.id, anchor);
    });
  }

  async startScanning(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;

    // Start simulated proximity scanning
    this.startProximityScanning();

    console.log('Expo Go beacon service started with simulated beacons');
  }

  async stopScanning(): Promise<void> {
    this.isActive = false;

    if (this.proximityInterval) {
      clearInterval(this.proximityInterval);
      this.proximityInterval = null;
    }

    this.simulatedReadings.clear();
    this.lastTriangulationResult = null;
  }

  private startProximityScanning(): void {
    // Simulate beacon scanning with realistic variations
    this.proximityInterval = setInterval(() => {
      if (!this.isActive) return;

      this.simulateBeaconReadings();
      this.performTriangulation();
    }, 1000);
  }

  private simulateBeaconReadings(): void {
    // Simulate discovering beacons at varying distances
    Array.from(this.knownAnchors.keys()).forEach((beaconId, index) => {
      // Simulate varying RSSI and distance based on movement
      const baseRSSI = -60;
      const timeVariation = Math.sin(Date.now() / 10000 + index) * 5; // Slow variation
      const noise = (Math.random() - 0.5) * 15; // Random noise
      const rssi = baseRSSI + timeVariation + noise - (index * 8);
      
      const distance = this.calculateDistanceFromRSSI(rssi, -59);
      const beacon = this.knownAnchors.get(beaconId)!;
      
      const reading = {
        id: beaconId,
        uuid: beacon.uuid,
        major: beacon.major,
        minor: beacon.minor,
        rssi,
        distance,
        accuracy: Math.abs(noise) / 10,
        proximity: this.determineProximity(distance),
        timestamp: Date.now()
      };

      // Store reading
      if (!this.simulatedReadings.has(beaconId)) {
        this.simulatedReadings.set(beaconId, []);
      }
      
      const readings = this.simulatedReadings.get(beaconId)!;
      readings.push(reading);
      
      // Keep only recent readings
      const cutoffTime = Date.now() - this.config.maxBeaconAge;
      this.simulatedReadings.set(
        beaconId,
        readings.filter(r => r.timestamp > cutoffTime)
      );

      this.config.onBeaconDetected?.(reading);
    });
  }

  private calculateDistanceFromRSSI(rssi: number, calibratedRSSI: number): number {
    // Distance calculation using RSSI (same as full version)
    const pathLossExponent = 2.5;
    const distance = Math.pow(10, (calibratedRSSI - rssi) / (10 * pathLossExponent));
    return Math.max(0.1, distance);
  }

  private determineProximity(distance: number): 'immediate' | 'near' | 'far' | 'unknown' {
    if (distance < 0.5) return 'immediate';
    if (distance < 3.0) return 'near';
    if (distance < 10.0) return 'far';
    return 'unknown';
  }

  private performTriangulation(): void {
    // Collect distance measurements
    const measurements: Array<{anchorId: string, distance: number, accuracy: number}> = [];

    for (const [beaconId, readings] of this.simulatedReadings) {
      if (readings.length > 0) {
        const recentReading = readings[readings.length - 1];
        measurements.push({
          anchorId: beaconId,
          distance: recentReading.distance,
          accuracy: recentReading.accuracy
        });
      }
    }

    if (measurements.length < this.config.minBeaconsForTrilateration) {
      return;
    }

    // Perform trilateration
    const result = this.trilaterate(measurements);
    if (result) {
      this.lastTriangulationResult = result;
      this.config.onPositionUpdate?.(result);
    }
  }

  private trilaterate(measurements: Array<{anchorId: string, distance: number, accuracy: number}>): TriangulationResult | null {
    try {
      // Sort by accuracy
      measurements.sort((a, b) => a.accuracy - b.accuracy);
      const usedMeasurements = measurements.slice(0, Math.min(4, measurements.length));
      
      if (usedMeasurements.length < 3) return null;

      // Get anchor positions
      const anchors = usedMeasurements.map(m => {
        const anchor = this.knownAnchors.get(m.anchorId);
        if (!anchor) return null;
        return {
          position: anchor.position,
          distance: m.distance,
          weight: 1 / (m.accuracy + 0.1)
        };
      }).filter(a => a !== null);

      if (anchors.length < 3) return null;

      // Weighted centroid method for Expo Go
      const position = this.weightedCentroid(anchors as any);
      const residualError = this.calculateResidualError(position, anchors as any);
      const confidence = Math.max(0.1, Math.min(0.9, 1.0 / (1.0 + residualError)));

      return {
        position,
        confidence,
        usedAnchors: usedMeasurements.map(m => m.anchorId),
        residualError,
        method: 'weighted_centroid'
      };
    } catch (error) {
      console.error('Expo Go trilateration error:', error);
      return null;
    }
  }

  private weightedCentroid(anchors: Array<{position: Point3D, distance: number, weight: number}>): Point3D {
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

  getCurrentPosition(): TriangulationResult | null {
    return this.lastTriangulationResult;
  }

  getKnownAnchors(): BeaconAnchor[] {
    return Array.from(this.knownAnchors.values());
  }

  getRecentBeaconReadings(): Map<string, any[]> {
    return new Map(this.simulatedReadings);
  }

  getPositionSource() {
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

export default ExpoGoBeaconService;
