import { Platform } from 'react-native';
import * as Location from 'expo-location';
import AdvancedLocationService, { FilteredLocation, GNSSReading } from './AdvancedLocationService';
import Spatial3DService, { Point3D, GeoPoint3D, SpatialPosition, PositionSource } from './Spatial3DService';
import ARVIOFusionService, { ARPose, VIOState } from './ARVIOFusionService';
import BeaconUWBService, { TriangulationResult } from './BeaconUWBService';
import MeshNetworkService, { MeshNode, DeliveryOptimization } from './MeshNetworkService';

// Fused positioning types
export interface FusedPosition {
  position: Point3D;
  geoPosition: GeoPoint3D;
  confidence: number;
  accuracy: number;
  sources: PositionSource[];
  timestamp: number;
  metadata: {
    gnssQuality: number;
    vioTracking: boolean;
    beaconCount: number;
    meshConnected: boolean;
    indoorMode: boolean;
    cruiseMode: boolean;
  };
}

export interface CruiseShipSettings {
  shipHeading: number; // degrees
  shipSpeed: number; // m/s
  shipAcceleration: Point3D;
  platformDetected: boolean;
  shipGPSReference: GeoPoint3D;
}

export interface FusedPositioningConfig {
  onPositionUpdate?: (position: FusedPosition) => void;
  onAccuracyImproved?: (newAccuracy: number, oldAccuracy: number) => void;
  onIndoorModeChanged?: (isIndoor: boolean) => void;
  onCruiseModeChanged?: (isCruise: boolean, shipSettings?: CruiseShipSettings) => void;
  venueId?: string;
  enableGNSS?: boolean;
  enableVIO?: boolean;
  enableBeacons?: boolean;
  enableMesh?: boolean;
  targetAccuracy?: number; // meters
  updateInterval?: number; // milliseconds
  cruiseShipMode?: boolean;
}

class FusedPositioningService {
  private config: FusedPositioningConfig;
  private isActive: boolean = false;

  // Component services
  private gnssService: AdvancedLocationService;
  private spatial3DService: Spatial3DService;
  private vioService: ARVIOFusionService;
  private beaconService: BeaconUWBService;
  private meshService: MeshNetworkService;

  // Current state
  private currentFusedPosition: FusedPosition | null = null;
  private positionHistory: FusedPosition[] = [];
  private cruiseShipSettings: CruiseShipSettings | null = null;
  private isIndoorMode: boolean = false;

  // Fusion algorithm
  private positionSources: Map<string, PositionSource> = new Map();
  private lastFusionTime: number = 0;
  private fusionInterval: any = null;

  // Quality metrics
  private qualityMetrics = {
    gnssSignalStrength: 0,
    vioConfidence: 0,
    beaconCoverage: 0,
    meshConnectivity: 0,
    overallAccuracy: 10.0 // Start with 10m accuracy
  };

  constructor(config: FusedPositioningConfig = {}) {
    this.config = {
      venueId: 'cruise_ship_venue',
      enableGNSS: true,
      enableVIO: true,
      enableBeacons: true,
      enableMesh: true,
      targetAccuracy: 1.0, // 1 meter target
      updateInterval: 1000, // 1 second
      cruiseShipMode: true,
      ...config
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize GNSS service with cruise ship optimizations
    this.gnssService = new AdvancedLocationService({
      onLocationUpdate: (location) => this.handleGNSSUpdate(location),
      onLocationError: (error) => console.error('GNSS Error:', error),
      maxAccuracyThreshold: this.config.cruiseShipMode ? 20 : 15, // More lenient for ships
      maxJumpDistance: this.config.cruiseShipMode ? 200 : 100, // Ships can move faster
      enableBackgroundUpdates: true
    });

    // Initialize 3D spatial service
    this.spatial3DService = new Spatial3DService({
      onPositionUpdate: (position) => this.handleSpatialUpdate(position),
      onFloorChange: (newFloor, oldFloor) => console.log(`Floor changed: ${oldFloor} → ${newFloor}`),
      onZoneEnter: (zone) => console.log(`Entered zone: ${zone.name}`),
      onZoneExit: (zone) => console.log(`Exited zone: ${zone.name}`),
      enableHighAccuracyMode: true,
      enable3DTracking: true
    });

    // Initialize VIO service for indoor positioning (no marker detection)
    this.vioService = new ARVIOFusionService({
      onPoseUpdate: (pose) => this.handleVIOUpdate(pose),
      onVisualMarkerDetected: (marker, pose) => console.log(`Visual marker detected: ${marker.id}`),
      onRelocalization: (pose, confidence) => console.log(`VIO relocalized with confidence: ${confidence}`),
      enableVisualFeatureTracking: true,
      enableIMUFusion: true
    });

    // Initialize beacon/UWB service
    this.beaconService = new BeaconUWBService({
      onPositionUpdate: (result) => this.handleBeaconUpdate(result),
      onBeaconDetected: (beacon) => console.log(`Beacon detected: ${beacon.id} at ${beacon.distance}m`),
      onUWBReading: (reading) => console.log(`UWB reading: ${reading.anchorId} at ${reading.distance}m`),
      enableBLE: true,
      enableUWB: Platform.OS === 'ios',
      minBeaconsForTrilateration: 3
    });

    // Initialize mesh network service
    this.meshService = new MeshNetworkService({
      onNodeDiscovered: (node) => console.log(`Mesh node discovered: ${node.id}`),
      onNodeLost: (nodeId) => console.log(`Mesh node lost: ${nodeId}`),
      onTriangulationRequest: (request) => this.handleTriangulationRequest(request),
      onDeliveryOptimization: (optimization) => this.handleDeliveryOptimization(optimization),
      nodeType: 'mobile',
      enableAutoDiscovery: true
    });
  }

  async startFusedPositioning(): Promise<void> {
    if (this.isActive) {
      console.log('Fused positioning already active');
      return;
    }

    try {
      this.isActive = true;

      // Load venue model
      if (this.config.venueId) {
        await this.spatial3DService.loadVenueModel(this.config.venueId);
      }

      // Start component services
      if (this.config.enableGNSS) {
        await this.gnssService.startContinuousTracking();
      }

      if (this.config.enableVIO) {
        await this.vioService.startVIOTracking();
      }

      if (this.config.enableBeacons) {
        await this.beaconService.startScanning();
      }

      if (this.config.enableMesh) {
        await this.meshService.startMeshNetwork();
      }

      // Start fusion algorithm
      this.startPositionFusion();

      // Initialize cruise ship mode if enabled
      if (this.config.cruiseShipMode) {
        await this.initializeCruiseShipMode();
      }

      console.log('Fused positioning system started');
    } catch (error) {
      this.isActive = false;
      console.error('Error starting fused positioning:', error);
      throw error;
    }
  }

  async stopFusedPositioning(): Promise<void> {
    this.isActive = false;

    // Stop component services
    if (this.gnssService.isTracking()) {
      await this.gnssService.stopTracking();
    }

    if (this.vioService.isTracking()) {
      await this.vioService.stopVIOTracking();
    }

    if (this.beaconService.isScanning()) {
      await this.beaconService.stopScanning();
    }

    if (this.meshService.isActive()) {
      await this.meshService.stopMeshNetwork();
    }

    // Stop fusion
    if (this.fusionInterval) {
      clearInterval(this.fusionInterval);
      this.fusionInterval = null;
    }

    // Clear state
    this.currentFusedPosition = null;
    this.positionSources.clear();
    this.positionHistory = [];

    console.log('Fused positioning system stopped');
  }

  private async initializeCruiseShipMode(): Promise<void> {
    console.log('Initializing cruise ship mode...');

    // Set up ship-specific settings
    this.cruiseShipSettings = {
      shipHeading: 0,
      shipSpeed: 0,
      shipAcceleration: { x: 0, y: 0, z: 0, timestamp: Date.now() },
      platformDetected: false,
      shipGPSReference: {
        latitude: 25.7612,
        longitude: -80.1923,
        altitude: 25,
        timestamp: Date.now()
      }
    };

    // Configure services for ship environment
    this.configureForCruiseShip();

    this.config.onCruiseModeChanged?.(true, this.cruiseShipSettings);
  }

  private configureForCruiseShip(): void {
    // Detect if we're on a moving platform (ship)
    this.detectMovingPlatform();

    // Adjust GNSS settings for marine environment
    // Ships have different motion characteristics than land vehicles
  }

  private detectMovingPlatform(): void {
    // Use IMU data to detect consistent platform motion
    // This helps distinguish between user movement and ship movement
    
    // Implementation would analyze:
    // - Low frequency motion patterns (ship rolling/pitching)
    // - Consistent velocity vectors
    // - GPS speed vs user motion patterns

    // For simulation:
    setTimeout(() => {
      if (this.cruiseShipSettings) {
        this.cruiseShipSettings.platformDetected = true;
        this.cruiseShipSettings.shipSpeed = 5.0; // 5 m/s (~10 knots)
        this.cruiseShipSettings.shipHeading = 90; // Heading east
        console.log('Moving platform (ship) detected');
      }
    }, 5000);
  }

  private startPositionFusion(): void {
    this.fusionInterval = setInterval(() => {
      this.performPositionFusion();
    }, this.config.updateInterval!);
  }

  private performPositionFusion(): void {
    const now = Date.now();

    // Collect all available position sources
    const availableSources: PositionSource[] = [];

    // GNSS source
    const gnssLocation = this.gnssService.getCurrentLocation();
    if (gnssLocation) {
      availableSources.push({
        type: 'gnss',
        weight: this.calculateGNSSWeight(gnssLocation),
        accuracy: gnssLocation.accuracy || 10,
        timestamp: gnssLocation.timestamp
      });
    }

    // VIO source
    if (this.vioService.isTracking()) {
      const vioSource = this.vioService.getPositionSource();
      if (vioSource) {
        availableSources.push(vioSource);
      }
    }

    // Beacon source
    if (this.beaconService.isScanning()) {
      const beaconSource = this.beaconService.getPositionSource();
      if (beaconSource) {
        availableSources.push(beaconSource);
      }
    }

    // Perform fusion if we have sources
    if (availableSources.length > 0) {
      const fusedPosition = this.fusePositionSources(availableSources);
      if (fusedPosition) {
        this.updateFusedPosition(fusedPosition);
      }
    }
  }

  private calculateGNSSWeight(gnssReading: GNSSReading): number {
    let weight = 0.5; // Base weight

    // Increase weight for good accuracy
    if (gnssReading.accuracy && gnssReading.accuracy < 5) {
      weight += 0.3;
    }

    // Decrease weight if we're indoors
    if (this.isIndoorMode) {
      weight *= 0.3;
    }

    // Adjust for cruise ship mode
    if (this.config.cruiseShipMode && this.cruiseShipSettings?.platformDetected) {
      // On ships, GNSS is more reliable for absolute positioning
      weight += 0.2;
    }

    return Math.min(1.0, weight);
  }

  private fusePositionSources(sources: PositionSource[]): FusedPosition | null {
    if (sources.length === 0) return null;

    // Sort sources by weight (reliability)
    sources.sort((a, b) => b.weight - a.weight);

    // Start with the most reliable source
    const primarySource = sources[0];
    let fusedPosition: Point3D;
    let fusedGeoPosition: GeoPoint3D;

    // Get position from primary source
    if (primarySource.type === 'gnss') {
      const gnssLocation = this.gnssService.getCurrentLocation();
      if (!gnssLocation) return null;

      fusedGeoPosition = {
        latitude: gnssLocation.latitude,
        longitude: gnssLocation.longitude,
        altitude: gnssLocation.altitude || 0,
        accuracy: gnssLocation.accuracy,
        timestamp: gnssLocation.timestamp
      };
      fusedPosition = this.spatial3DService.convertGeoToLocal(fusedGeoPosition);
    } else if (primarySource.type === 'vio') {
      const vioState = this.vioService.getCurrentVIOState();
      if (!vioState) return null;

      fusedPosition = vioState.position;
      fusedGeoPosition = this.spatial3DService.convertLocalToGeo(fusedPosition);
    } else if (primarySource.type === 'beacon') {
      const beaconResult = this.beaconService.getCurrentPosition();
      if (!beaconResult) return null;

      fusedPosition = beaconResult.position;
      fusedGeoPosition = this.spatial3DService.convertLocalToGeo(fusedPosition);
    } else {
      return null;
    }

    // Blend with other sources using weighted average
    if (sources.length > 1) {
      const blendedPosition = this.weightedAverageBlend(fusedPosition, sources);
      if (blendedPosition) {
        fusedPosition = blendedPosition;
        fusedGeoPosition = this.spatial3DService.convertLocalToGeo(fusedPosition);
      }
    }

    // Apply cruise ship corrections
    if (this.config.cruiseShipMode && this.cruiseShipSettings?.platformDetected) {
      fusedPosition = this.applyCruiseShipCorrections(fusedPosition);
      fusedGeoPosition = this.spatial3DService.convertLocalToGeo(fusedPosition);
    }

    // Calculate overall confidence and accuracy
    const totalWeight = sources.reduce((sum, source) => sum + source.weight, 0);
    const confidence = Math.min(0.95, totalWeight / sources.length);
    const accuracy = this.calculateFusedAccuracy(sources);

    // Detect indoor mode
    const wasIndoor = this.isIndoorMode;
    this.isIndoorMode = this.detectIndoorMode(sources, accuracy);
    if (wasIndoor !== this.isIndoorMode) {
      this.config.onIndoorModeChanged?.(this.isIndoorMode);
    }

    // Update quality metrics
    this.updateQualityMetrics(sources, accuracy);

    return {
      position: fusedPosition,
      geoPosition: fusedGeoPosition,
      confidence,
      accuracy,
      sources,
      timestamp: Date.now(),
      metadata: {
        gnssQuality: this.qualityMetrics.gnssSignalStrength,
        vioTracking: this.vioService.isTracking(),
        beaconCount: this.beaconService.getRecentBeaconReadings().size,
        meshConnected: this.meshService.isActive(),
        indoorMode: this.isIndoorMode,
        cruiseMode: this.config.cruiseShipMode || false
      }
    };
  }

  private weightedAverageBlend(primaryPosition: Point3D, sources: PositionSource[]): Point3D | null {
    // Simple weighted average blending
    // In a real implementation, this would be much more sophisticated

    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;

    for (const source of sources) {
      let position: Point3D | null = null;

      // Get position from each source
      if (source.type === 'vio') {
        const vioState = this.vioService.getCurrentVIOState();
        position = vioState?.position || null;
      } else if (source.type === 'beacon') {
        const beaconResult = this.beaconService.getCurrentPosition();
        position = beaconResult?.position || null;
      } else if (source.type === 'gnss') {
        const gnssLocation = this.gnssService.getCurrentLocation();
        if (gnssLocation) {
          position = this.spatial3DService.convertGeoToLocal({
            latitude: gnssLocation.latitude,
            longitude: gnssLocation.longitude,
            altitude: gnssLocation.altitude || 0,
            timestamp: gnssLocation.timestamp
          });
        }
      }

      if (position) {
        const weight = source.weight;
        totalWeight += weight;
        weightedX += position.x * weight;
        weightedY += position.y * weight;
        weightedZ += position.z * weight;
      }
    }

    if (totalWeight === 0) return null;

    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight,
      z: weightedZ / totalWeight,
      timestamp: Date.now()
    };
  }

  private applyCruiseShipCorrections(position: Point3D): Point3D {
    if (!this.cruiseShipSettings) return position;

    // Apply ship motion compensation
    // This would account for ship's movement, rotation, and acceleration
    
    // For simulation, just return the position with minor adjustments
    return {
      x: position.x,
      y: position.y,
      z: position.z,
      timestamp: position.timestamp
    };
  }

  private calculateFusedAccuracy(sources: PositionSource[]): number {
    // Calculate weighted accuracy
    let totalWeight = 0;
    let weightedAccuracy = 0;

    for (const source of sources) {
      totalWeight += source.weight;
      weightedAccuracy += source.accuracy * source.weight;
    }

    return totalWeight > 0 ? weightedAccuracy / totalWeight : 10.0;
  }

  private detectIndoorMode(sources: PositionSource[], accuracy: number): boolean {
    // Indoor mode detection logic
    const hasGNSS = sources.some(s => s.type === 'gnss');
    const hasBeacons = sources.some(s => s.type === 'beacon');
    const hasVIO = sources.some(s => s.type === 'vio');

    // Indoor if:
    // - Poor GNSS accuracy
    // - Strong beacon signals
    // - VIO tracking active
    const poorGNSS = !hasGNSS || accuracy > 15;
    const strongIndoorSignals = hasBeacons || hasVIO;

    return poorGNSS && strongIndoorSignals;
  }

  private updateQualityMetrics(sources: PositionSource[], accuracy: number): void {
    // Update quality metrics
    this.qualityMetrics.gnssSignalStrength = sources.find(s => s.type === 'gnss')?.weight || 0;
    this.qualityMetrics.vioConfidence = sources.find(s => s.type === 'vio')?.weight || 0;
    this.qualityMetrics.beaconCoverage = sources.filter(s => s.type === 'beacon').length / 4; // Normalize to 0-1
    this.qualityMetrics.meshConnectivity = this.meshService.isActive() ? 1 : 0;

    const oldAccuracy = this.qualityMetrics.overallAccuracy;
    this.qualityMetrics.overallAccuracy = accuracy;

    // Notify about accuracy improvements
    if (accuracy < oldAccuracy && accuracy < this.config.targetAccuracy!) {
      this.config.onAccuracyImproved?.(accuracy, oldAccuracy);
    }
  }

  private updateFusedPosition(position: FusedPosition): void {
    this.currentFusedPosition = position;
    this.positionHistory.push(position);

    // Limit history size
    if (this.positionHistory.length > 100) {
      this.positionHistory.shift();
    }

    // Update component services
    this.spatial3DService.updatePosition(position.geoPosition, position.sources);
    this.meshService.updateLocalPosition(position.position, position.geoPosition);

    // Apply VIO-GNSS fusion
    if (this.vioService.isTracking()) {
      this.vioService.fuseWithGNSS(position.geoPosition, this.spatial3DService);
    }

    // Notify subscribers
    this.config.onPositionUpdate?.(position);
  }

  // Event handlers
  private handleGNSSUpdate(location: FilteredLocation): void {
    console.log(`GNSS update: accuracy ${location.location.accuracy}m, confidence ${location.confidence}`);
  }

  private handleSpatialUpdate(position: SpatialPosition): void {
    console.log(`Spatial update: floor ${position.floor}, zone ${position.zone?.name || 'none'}`);
  }

  private handleVIOUpdate(pose: ARPose): void {
    console.log(`VIO update: confidence ${pose.confidence}`);
  }

  private handleBeaconUpdate(result: TriangulationResult): void {
    console.log(`Beacon triangulation: ${result.usedAnchors.length} anchors, accuracy ${result.residualError}m`);
  }

  private handleTriangulationRequest(request: any): void {
    console.log(`Triangulation request from ${request.requesterId}`);
  }

  private handleDeliveryOptimization(optimization: DeliveryOptimization): void {
    console.log(`Delivery optimization: recommended bar ${optimization.recommendedBar}`);
  }

  // Public API
  getCurrentPosition(): FusedPosition | null {
    return this.currentFusedPosition;
  }

  getPositionHistory(): FusedPosition[] {
    return [...this.positionHistory];
  }

  getQualityMetrics() {
    return { ...this.qualityMetrics };
  }

  getCruiseShipSettings(): CruiseShipSettings | null {
    return this.cruiseShipSettings;
  }

  optimizeDeliveryRoute(customerId: string): DeliveryOptimization | null {
    if (!this.currentFusedPosition) return null;

    return this.meshService.optimizeDeliveryRoute(customerId, this.currentFusedPosition.position);
  }

  findNearestBar(): MeshNode | null {
    if (!this.currentFusedPosition) return null;

    return this.meshService.findNearestBarStation(this.currentFusedPosition.position);
  }

  isActive(): boolean {
    return this.isActive;
  }
}

export default FusedPositioningService;
