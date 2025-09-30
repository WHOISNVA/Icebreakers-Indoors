import { Platform } from 'react-native';
import * as Location from 'expo-location';
import Spatial3DService, { Point3D, GeoPoint3D, SpatialPosition, PositionSource } from './Spatial3DService';

// Expo Go compatible services
import ExpoGoLocationService, { FilteredLocation, GNSSReading } from './ExpoGoLocationService';
import ExpoGoMotionService from './ExpoGoMotionService';
import ExpoGoBeaconService from './ExpoGoBeaconService';
import ExpoGoMeshService, { MeshNode, DeliveryOptimization } from './ExpoGoMeshService';

// Types from Expo Go services
export interface ARPose {
  position: Point3D;
  orientation: { x: number; y: number; z: number; w: number };
  confidence: number;
  timestamp: number;
}

export interface VIOState {
  position: Point3D;
  velocity: Point3D;
  orientation: { x: number; y: number; z: number; w: number };
  angularVelocity: Point3D;
  timestamp: number;
  confidence: number;
}

export interface TriangulationResult {
  position: Point3D;
  confidence: number;
  usedAnchors: string[];
  residualError: number;
  method: string;
}

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
  seaLevelElevation: number; // meters above sea level
  deckElevations: Map<number, number>; // deck -> elevation above sea level
  shipDimensions: {
    length: number; // meters
    width: number; // meters
    height: number; // meters
  };
  shipMotionState: {
    roll: number; // degrees
    pitch: number; // degrees
    yaw: number; // degrees
    heave: number; // vertical motion in meters
  };
}

export interface FusedPositioningConfig {
  onPositionUpdate?: (position: FusedPosition) => void;
  onAccuracyImproved?: (newAccuracy: number, oldAccuracy: number) => void;
  onIndoorModeChanged?: (isIndoor: boolean) => void;
  onCruiseModeChanged?: (isCruise: boolean, shipSettings?: CruiseShipSettings) => void;
  onShipMotionDetected?: (motionState: CruiseShipSettings['shipMotionState']) => void;
  venueId?: string;
  enableGNSS?: boolean;
  enableVIO?: boolean;
  enableBeacons?: boolean;
  enableMesh?: boolean;
  targetAccuracy?: number; // meters
  updateInterval?: number; // milliseconds
  cruiseShipMode?: boolean;
  shipConfiguration?: {
    shipName?: string;
    deckCount?: number;
    seaLevelOffset?: number; // meters above actual sea level for GPS reference
    enableMotionCompensation?: boolean;
    enableDeckTracking?: boolean;
  };
}

class FusedPositioningService {
  private config: FusedPositioningConfig;
  private _isActive: boolean = false;

  // Component services - all Expo Go compatible
  private gnssService!: ExpoGoLocationService;
  private spatial3DService!: Spatial3DService;
  private vioService?: ExpoGoMotionService;
  private beaconService?: ExpoGoBeaconService;
  private meshService?: ExpoGoMeshService;

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
    // Check if we're in Expo Go without importing expo-constants
    // In Expo Go, we'll use compatible alternative services
    const isExpoGo = __DEV__ && typeof (global as any).__expo !== 'undefined';

    this.config = {
      venueId: 'delivery_venue',
      enableGNSS: config.enableGNSS ?? true,
      enableVIO: config.enableVIO ?? true,  // Always enabled, use Expo Go compatible version
      enableBeacons: config.enableBeacons ?? true,  // Always enabled, use Expo Go compatible version
      enableMesh: isExpoGo ? false : config.enableMesh ?? true,  // Only mesh is disabled in Expo Go
      targetAccuracy: config.targetAccuracy ?? 1.0,
      updateInterval: config.updateInterval ?? 1000,
      cruiseShipMode: config.cruiseShipMode ?? false,
      ...config
    };

    // Services will be initialized when startFusedPositioning is called
  }

  private async initializeServices(): Promise<void> {
    // Check if we're in Expo Go
    const isExpoGo = __DEV__ && typeof (global as any).__expo !== 'undefined';

    if (isExpoGo) {
      console.log('Initializing Expo Go compatible services');
      
      // Use Expo Go compatible services
      this.gnssService = new ExpoGoLocationService({
        onLocationUpdate: (location) => this.handleGNSSUpdate(location),
        onLocationError: (error) => console.error('GNSS Error:', error),
        maxAccuracyThreshold: this.config.cruiseShipMode ? 20 : 15,
        maxJumpDistance: this.config.cruiseShipMode ? 200 : 100,
      });

      if (this.config.enableVIO) {
        this.vioService = new ExpoGoMotionService({
          onPoseUpdate: (pose) => this.handleVIOUpdate(pose),
          imuUpdateRate: 60
        });
      }

      if (this.config.enableBeacons) {
        this.beaconService = new ExpoGoBeaconService({
          onPositionUpdate: (result) => this.handleBeaconUpdate(result),
          onBeaconDetected: (beacon) => console.log(`Beacon detected: ${beacon.id} at ${beacon.distance}m`),
          minBeaconsForTrilateration: 3
        });
      }

      // Mesh service not available in Expo Go
      this.meshService = null;
      
    } else {
      console.log('Initializing full native services');
      
      // Dynamically import full native services
      if (!AdvancedLocationService) {
        const module = await import('./AdvancedLocationService');
        AdvancedLocationService = module.default;
      }

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
    if (this.config.enableVIO) {
      if (!ARVIOFusionService) {
        const module = await import('./ARVIOFusionService');
        ARVIOFusionService = module.default;
      }
      this.vioService = new ARVIOFusionService({
        onPoseUpdate: (pose) => this.handleVIOUpdate(pose),
        onVisualMarkerDetected: (marker, pose) => console.log(`Visual marker detected: ${marker.id}`),
        onRelocalization: (pose, confidence) => console.log(`VIO relocalized with confidence: ${confidence}`),
        enableVisualFeatureTracking: true,
        enableIMUFusion: true
      });
    }

    // Initialize beacon/UWB service
    if (this.config.enableBeacons) {
      if (!BeaconUWBService) {
        const module = await import('./BeaconUWBService');
        BeaconUWBService = module.default;
      }
      this.beaconService = new BeaconUWBService({
        onPositionUpdate: (result) => this.handleBeaconUpdate(result),
        onBeaconDetected: (beacon) => console.log(`Beacon detected: ${beacon.id} at ${beacon.distance}m`),
        onUWBReading: (reading) => console.log(`UWB reading: ${reading.anchorId} at ${reading.distance}m`),
        enableBLE: true,
        enableUWB: Platform.OS === 'ios',
        minBeaconsForTrilateration: 3
      });
    }

    // Initialize mesh network service
    if (this.config.enableMesh) {
      if (!MeshNetworkService) {
        const module = await import('./MeshNetworkService');
        MeshNetworkService = module.default;
      }
      this.meshService = new MeshNetworkService({
        onNodeDiscovered: (node) => console.log(`Mesh node discovered: ${node.id}`),
        onNodeLost: (nodeId) => console.log(`Mesh node lost: ${nodeId}`),
        onTriangulationRequest: (request) => this.handleTriangulationRequest(request),
        onDeliveryOptimization: (optimization) => this.handleDeliveryOptimization(optimization),
        nodeType: 'mobile',
        enableAutoDiscovery: true
      });
    }
    }  // End of else block
  }

  async startFusedPositioning(): Promise<void> {
    if (this._isActive) {
      console.log('Fused positioning already active');
      return;
    }

    try {
      this._isActive = true;

      // Initialize services first
      await this.initializeServices();

      // Load venue model
      if (this.config.venueId) {
        await this.spatial3DService.loadVenueModel(this.config.venueId);
      }

      // Start component services
      if (this.config.enableGNSS) {
        await this.gnssService.startContinuousTracking();
      }

      if (this.config.enableVIO) {
        await this.vioService?.startVIOTracking();
      }

      if (this.config.enableBeacons) {
        await this.beaconService?.startScanning();
      }

      if (this.config.enableMesh) {
        await this.meshService?.startMeshNetwork();
      }

      // Start fusion algorithm
      this.startPositionFusion();

      // Initialize cruise ship mode if enabled
      if (this.config.cruiseShipMode) {
        await this.initializeCruiseShipMode();
      }

      console.log('Fused positioning system started');
    } catch (error) {
      this._isActive = false;
      console.error('Error starting fused positioning:', error);
      throw error;
    }
  }

  async stopFusedPositioning(): Promise<void> {
    this._isActive = false;

    // Stop component services
    if (this.gnssService.isTracking()) {
      await this.gnssService.stopTracking();
    }

    if (this.vioService?.isTracking()) {
      await this.vioService.stopVIOTracking();
    }

    if (this.beaconService?.isScanning()) {
      await this.beaconService.stopScanning();
    }

    if (this.meshService?.isActive()) {
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

    // Get initial GPS position for sea level reference
    const initialPosition = this.gnssService.getCurrentLocation();
    const seaLevelElevation = initialPosition?.altitude || 0;

    // Set up ship-specific settings
    this.cruiseShipSettings = {
      shipHeading: 0,
      shipSpeed: 0,
      shipAcceleration: { x: 0, y: 0, z: 0, timestamp: Date.now() },
      platformDetected: false,
      shipGPSReference: {
        latitude: initialPosition?.latitude || 25.7612,
        longitude: initialPosition?.longitude || -80.1923,
        altitude: seaLevelElevation,
        timestamp: Date.now()
      },
      seaLevelElevation: seaLevelElevation + (this.config.shipConfiguration?.seaLevelOffset || 0),
      deckElevations: this.initializeDeckElevations(),
      shipDimensions: {
        length: 300, // Default cruise ship dimensions
        width: 35,
        height: 60
      },
      shipMotionState: {
        roll: 0,
        pitch: 0,
        yaw: 0,
        heave: 0
      }
    };

    // Configure services for ship environment
    this.configureForCruiseShip();

    this.config.onCruiseModeChanged?.(true, this.cruiseShipSettings);
  }

  private initializeDeckElevations(): Map<number, number> {
    const deckElevations = new Map<number, number>();
    const deckCount = this.config.shipConfiguration?.deckCount || 12;
    const seaLevel = this.cruiseShipSettings?.seaLevelElevation || 0;
    
    // Standard cruise ship deck spacing (approximately 3.5m per deck)
    for (let deck = 1; deck <= deckCount; deck++) {
      const elevation = seaLevel + (deck * 3.5);
      deckElevations.set(deck, elevation);
    }
    
    return deckElevations;
  }

  private configureForCruiseShip(): void {
    // Detect if we're on a moving platform (ship)
    this.detectMovingPlatform();

    // Start ship motion monitoring if enabled
    if (this.config.shipConfiguration?.enableMotionCompensation) {
      this.startShipMotionMonitoring();
    }

    // Adjust GNSS settings for marine environment
    // Ships have different motion characteristics than land vehicles
    console.log(`Ship configured: ${this.config.shipConfiguration?.shipName || 'Unknown vessel'}`);
    console.log(`Sea level elevation: ${this.cruiseShipSettings?.seaLevelElevation}m`);
    console.log(`Deck count: ${this.config.shipConfiguration?.deckCount || 12}`);
  }

  private startShipMotionMonitoring(): void {
    // Monitor ship motion (roll, pitch, yaw, heave) using IMU data
    setInterval(() => {
      if (!this.cruiseShipSettings || !this.config.cruiseShipMode) return;

      // Simulate ship motion detection (in real implementation, this would use IMU data)
      const motionState = {
        roll: (Math.random() - 0.5) * 10, // ±5 degrees
        pitch: (Math.random() - 0.5) * 8, // ±4 degrees  
        yaw: this.cruiseShipSettings.shipHeading + (Math.random() - 0.5) * 2,
        heave: (Math.random() - 0.5) * 1.5 // ±0.75m vertical motion
      };

      this.cruiseShipSettings.shipMotionState = motionState;
      this.config.onShipMotionDetected?.(motionState);

      // Log significant motion
      if (Math.abs(motionState.roll) > 3 || Math.abs(motionState.pitch) > 3) {
        console.log(`Ship motion: Roll ${motionState.roll.toFixed(1)}°, Pitch ${motionState.pitch.toFixed(1)}°`);
      }
    }, 2000); // Update every 2 seconds
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
    if (this.vioService?.isTracking()) {
      const vioSource = this.vioService.getPositionSource();
      if (vioSource) {
        availableSources.push(vioSource);
      }
    }

    // Beacon source
    if (this.beaconService?.isScanning()) {
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
        accuracy: gnssLocation.accuracy ?? undefined,
        timestamp: gnssLocation.timestamp
      };
      fusedPosition = this.spatial3DService.convertGeoToLocal(fusedGeoPosition);
    } else if (primarySource.type === 'vio') {
      const vioState = this.vioService?.getCurrentVIOState();
      if (!vioState) return null;

      fusedPosition = vioState.position;
      fusedGeoPosition = this.spatial3DService.convertLocalToGeo(fusedPosition);
    } else if (primarySource.type === 'beacon') {
      const beaconResult = this.beaconService?.getCurrentPosition();
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
        vioTracking: this.vioService?.isTracking() ?? false,
        beaconCount: this.beaconService?.getRecentBeaconReadings().size ?? 0,
        meshConnected: this.meshService?.isActive() ?? false,
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
        const vioState = this.vioService?.getCurrentVIOState();
        position = vioState?.position || null;
      } else if (source.type === 'beacon') {
        const beaconResult = this.beaconService?.getCurrentPosition();
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
    if (!this.cruiseShipSettings || !this.config.shipConfiguration?.enableMotionCompensation) {
      return position;
    }

    // Apply ship motion compensation
    const motionState = this.cruiseShipSettings.shipMotionState;
    
    // Compensate for ship roll and pitch affecting position
    const rollRadians = motionState.roll * Math.PI / 180;
    const pitchRadians = motionState.pitch * Math.PI / 180;
    
    // Apply motion corrections (simplified 3D rotation compensation)
    const correctedPosition = {
      x: position.x + (motionState.heave * Math.sin(rollRadians) * 0.1),
      y: position.y + (motionState.heave * Math.sin(pitchRadians) * 0.1),
      z: position.z + motionState.heave, // Direct heave compensation
      timestamp: position.timestamp
    };

    // Ensure position stays within ship bounds
    return this.constrainToShipBounds(correctedPosition);
  }

  private constrainToShipBounds(position: Point3D): Point3D {
    if (!this.cruiseShipSettings) return position;

    const shipDims = this.cruiseShipSettings.shipDimensions;
    const halfLength = shipDims.length / 2;
    const halfWidth = shipDims.width / 2;

    return {
      x: Math.max(-halfWidth, Math.min(halfWidth, position.x)),
      y: Math.max(-halfLength, Math.min(halfLength, position.y)),
      z: Math.max(0, Math.min(shipDims.height, position.z)),
      timestamp: position.timestamp
    };
  }

  // Get current deck based on elevation
  getCurrentDeck(): number | null {
    if (!this.cruiseShipSettings || !this.currentFusedPosition) return null;

    const currentElevation = this.currentFusedPosition.geoPosition.altitude;
    let closestDeck = 1;
    let minDistance = Infinity;

    for (const [deck, elevation] of this.cruiseShipSettings.deckElevations) {
      const distance = Math.abs(currentElevation - elevation);
      if (distance < minDistance) {
        minDistance = distance;
        closestDeck = deck;
      }
    }

    return closestDeck;
  }

  // Get elevation above sea level
  getElevationAboveSeaLevel(): number | null {
    if (!this.currentFusedPosition || !this.cruiseShipSettings) return null;
    
    return this.currentFusedPosition.geoPosition.altitude - this.cruiseShipSettings.seaLevelElevation;
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
    this.qualityMetrics.meshConnectivity = this.meshService?.isActive() ? 1 : 0;

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
    this.meshService?.updateLocalPosition(position.position, position.geoPosition);

    // Apply VIO-GNSS fusion
    if (this.vioService?.isTracking()) {
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

    return this.meshService?.optimizeDeliveryRoute(customerId, this.currentFusedPosition.position) ?? null;
  }

  findNearestBar(): MeshNode | null {
    if (!this.currentFusedPosition) return null;

    return this.meshService?.findNearestBarStation(this.currentFusedPosition.position) ?? null;
  }

  isActive(): boolean {
    return this._isActive;
  }
}

export default FusedPositioningService;
