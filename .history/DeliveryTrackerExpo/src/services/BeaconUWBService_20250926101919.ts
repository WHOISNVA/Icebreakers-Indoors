import { Platform, PermissionsAndroid } from 'react-native';
import { Point3D, PositionSource } from './Spatial3DService';

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

class BeaconUWBService {
  private config: BeaconUWBConfig;
  private isActive: boolean = false;
  
  // Beacon management
  private knownAnchors: Map<string, BeaconAnchor> = new Map();
  private recentBeaconReadings: Map<string, BeaconReading[]> = new Map();
  private recentUWBReadings: Map<string, UWBReading[]> = new Map();
  
  // Scanning intervals
  private bleScanner: any = null;
  private uwbScanner: any = null;
  private triangulationInterval: any = null;
  
  // Position history
  private lastTriangulationResult: TriangulationResult | null = null;
  private positionHistory: TriangulationResult[] = [];

  constructor(config: BeaconUWBConfig = {}) {
    this.config = {
      enableBLE: true,
      enableUWB: Platform.OS === 'ios', // UWB support varies by platform
      enableQRMarkers: true,
      minBeaconsForTrilateration: 3,
      maxBeaconAge: 5000, // 5 seconds
      rssiFilterAlpha: 0.3,
      ...config
    };

    this.initializeKnownAnchors();
  }

  private initializeKnownAnchors(): void {
    // Sample beacon anchors for the venue
    const anchors: BeaconAnchor[] = [
      {
        id: 'bar_main_beacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 1,
        minor: 1,
        position: { x: 0, y: 0, z: 2.5, timestamp: Date.now() },
        txPower: -59,
        calibratedRSSI: -59,
        type: 'ibeacon'
      },
      {
        id: 'bar_side_beacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 1,
        minor: 2,
        position: { x: 20, y: 0, z: 2.5, timestamp: Date.now() },
        txPower: -59,
        calibratedRSSI: -59,
        type: 'ibeacon'
      },
      {
        id: 'seating_north_beacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 1,
        minor: 3,
        position: { x: -15, y: -30, z: 2.5, timestamp: Date.now() },
        txPower: -59,
        calibratedRSSI: -59,
        type: 'ibeacon'
      },
      {
        id: 'seating_south_beacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 1,
        minor: 4,
        position: { x: 15, y: -50, z: 2.5, timestamp: Date.now() },
        txPower: -59,
        calibratedRSSI: -59,
        type: 'ibeacon'
      },
      // UWB anchors (if supported)
      {
        id: 'uwb_anchor_1',
        uuid: 'UWB_ANCHOR_1',
        major: 2,
        minor: 1,
        position: { x: -25, y: 25, z: 3.0, timestamp: Date.now() },
        txPower: 0,
        calibratedRSSI: 0,
        type: 'uwb'
      },
      {
        id: 'uwb_anchor_2',
        uuid: 'UWB_ANCHOR_2',
        major: 2,
        minor: 2,
        position: { x: 25, y: 25, z: 3.0, timestamp: Date.now() },
        txPower: 0,
        calibratedRSSI: 0,
        type: 'uwb'
      }
    ];

    anchors.forEach(anchor => {
      this.knownAnchors.set(anchor.id, anchor);
    });
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Request Bluetooth permissions for Android
        const bluetoothPermissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ];

        const granted = await PermissionsAndroid.requestMultiple(bluetoothPermissions);
        
        const allGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          console.warn('Not all Bluetooth permissions granted');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  async startScanning(): Promise<void> {
    if (this.isActive) {
      console.log('Beacon/UWB scanning already active');
      return;
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Required permissions not granted');
    }

    this.isActive = true;

    try {
      // Start BLE beacon scanning
      if (this.config.enableBLE) {
        await this.startBLEScanning();
      }

      // Start UWB scanning (if supported)
      if (this.config.enableUWB) {
        await this.startUWBScanning();
      }

      // Start triangulation interval
      this.triangulationInterval = setInterval(() => {
        this.performTriangulation();
      }, 1000); // Triangulate every second

      console.log('Beacon/UWB scanning started');
    } catch (error) {
      this.isActive = false;
      console.error('Error starting beacon/UWB scanning:', error);
      throw error;
    }
  }

  async stopScanning(): Promise<void> {
    this.isActive = false;

    // Stop BLE scanning
    if (this.bleScanner) {
      // Implementation would stop BLE scanning here
      this.bleScanner = null;
    }

    // Stop UWB scanning
    if (this.uwbScanner) {
      // Implementation would stop UWB scanning here
      this.uwbScanner = null;
    }

    // Stop triangulation
    if (this.triangulationInterval) {
      clearInterval(this.triangulationInterval);
      this.triangulationInterval = null;
    }

    // Clear readings
    this.recentBeaconReadings.clear();
    this.recentUWBReadings.clear();

    console.log('Beacon/UWB scanning stopped');
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

  // QR Code marker positioning
  processQRMarker(qrContent: string, estimatedDistance: number = 2.0): TriangulationResult | null {
    // Parse QR content to find known marker
    if (!qrContent.startsWith('VENUE:')) return null;

    const parts = qrContent.split(':');
    if (parts.length < 3) return null;

    const markerId = `${parts[1]}_qr`;
    const anchor = this.knownAnchors.get(markerId);
    
    if (!anchor) {
      console.warn(`Unknown QR marker: ${markerId}`);
      return null;
    }

    // Estimate position based on QR marker location
    // In a real implementation, this would use camera pose estimation
    const estimatedPosition = {
      x: anchor.position.x + (Math.random() - 0.5) * 2, // ±1m uncertainty
      y: anchor.position.y - estimatedDistance, // Assume looking at marker
      z: anchor.position.z - 1.5, // Camera height
      timestamp: Date.now()
    };

    return {
      position: estimatedPosition,
      confidence: 0.8, // High confidence for QR markers
      usedAnchors: [markerId],
      residualError: 0.5,
      method: 'trilateration'
    };
  }

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
