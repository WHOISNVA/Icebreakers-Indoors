import MotionService from './MotionService';
import FusedPositioningService, { FusedPosition, CruiseShipSettings } from './FusedPositioningService';
import ShipDetectionService, { ShipDetectionResult } from './ShipDetectionService';

// Enhanced Motion Service that integrates with the advanced positioning system
export interface EnhancedMotionConfig {
  onPositionUpdate?: (position: FusedPosition) => void;
  onAccuracyImproved?: (accuracy: number) => void;
  onCruiseShipDetected?: (settings: CruiseShipSettings) => void;
  onShipMotionDetected?: (motionState: any) => void;
  enableAdvancedPositioning?: boolean;
  targetAccuracy?: number; // meters
  shipConfiguration?: {
    shipName?: string;
    deckCount?: number;
    seaLevelOffset?: number;
    enableMotionCompensation?: boolean;
    enableDeckTracking?: boolean;
  };
}

class EnhancedMotionService extends MotionService {
  private fusedPositioningService: FusedPositioningService | null = null;
  private enhancedConfig: EnhancedMotionConfig;

  constructor(config: EnhancedMotionConfig = {}) {
    // Initialize base motion service
    super({
      onMotionChange: config.onPositionUpdate ? (motion) => {
        console.log(`Motion detected: ${motion.activity} (confidence: ${motion.confidence})`);
      } : undefined,
      onLocationBurst: config.onPositionUpdate ? (location) => {
        console.log(`Location burst: ${location.coords.accuracy}m accuracy`);
      } : undefined
    });

    this.enhancedConfig = {
      enableAdvancedPositioning: true,
      targetAccuracy: 1.0, // 1 meter target for all venues
      ...config
    };

    if (this.enhancedConfig.enableAdvancedPositioning) {
      this.initializeFusedPositioning();
    }
  }

  private initializeFusedPositioning(): void {
    this.fusedPositioningService = new FusedPositioningService({
      onPositionUpdate: (position) => {
        this.enhancedConfig.onPositionUpdate?.(position);
        
        // Log position quality
        console.log(`Fused position: accuracy ${position.accuracy.toFixed(2)}m, confidence ${position.confidence.toFixed(2)}`);
        console.log(`Sources: ${position.sources.map(s => s.type).join(', ')}`);
        
        if (position.metadata.cruiseMode) {
          console.log(`Cruise mode active - Indoor: ${position.metadata.indoorMode}`);
        }
      },
      onAccuracyImproved: (newAccuracy, oldAccuracy) => {
        console.log(`Accuracy improved: ${oldAccuracy.toFixed(2)}m → ${newAccuracy.toFixed(2)}m`);
        this.enhancedConfig.onAccuracyImproved?.(newAccuracy);
      },
      onCruiseModeChanged: (isCruise, shipSettings) => {
        if (isCruise && shipSettings) {
          console.log(`Cruise ship mode activated - Ship speed: ${shipSettings.shipSpeed}m/s`);
          this.enhancedConfig.onCruiseShipDetected?.(shipSettings);
        }
      },
      onShipMotionDetected: (motionState) => {
        this.enhancedConfig.onShipMotionDetected?.(motionState);
      },
      venueId: 'delivery_venue',
      enableGNSS: true,
      enableVIO: true,
      enableBeacons: true,
      enableMesh: true,
      targetAccuracy: this.enhancedConfig.targetAccuracy,
      cruiseShipMode: !!this.enhancedConfig.shipConfiguration, // Enable when ship config provided
      shipConfiguration: this.enhancedConfig.shipConfiguration
    });
  }

  async startEnhancedMonitoring(): Promise<void> {
    // Start base motion monitoring
    await this.startMonitoring();

    // Start advanced positioning if enabled
    if (this.fusedPositioningService) {
      try {
        await this.fusedPositioningService.startFusedPositioning();
        console.log('Enhanced motion monitoring with advanced positioning started');
      } catch (error) {
        console.error('Failed to start advanced positioning, falling back to basic mode:', error);
      }
    }
  }

  async startEnhancedMonitoringWithAutoDetection(): Promise<void> {
    // Auto-detect ship environment first
    const isShipDetected = await ShipDetectionService.detectShipEnvironment();
    
    if (isShipDetected && this.fusedPositioningService) {
      console.log('Ship environment detected - auto-enabling ship mode');
      
      // Update configuration to enable ship mode
      this.enhancedConfig.shipConfiguration = {
        shipName: 'Auto-Detected Vessel',
        deckCount: 12,
        seaLevelOffset: 15,
        enableMotionCompensation: true,
        enableDeckTracking: true
      };
      
      // Reinitialize with ship configuration
      this.initializeFusedPositioning();
    }

    // Start regular monitoring
    await this.startEnhancedMonitoring();
  }

  async stopEnhancedMonitoring(): Promise<void> {
    await this.stopMonitoring();
    
    if (this.fusedPositioningService) {
      this.fusedPositioningService.stopFusedPositioning();
      console.log('Enhanced motion monitoring stopped');
    }
  }

  getQualityMetrics() {
    if (!this.fusedPositioningService) {
      return {
        gnssAccuracy: 0,
        vioAccuracy: 0,
        beaconAccuracy: 0,
        meshConnectivity: 0,
        overallAccuracy: 10.0
      };
    }
    return this.fusedPositioningService.getQualityMetrics();
  }

  isAdvancedPositioningActive(): boolean {
    return this.fusedPositioningService?.isActive() || false;
  }

  // Ship-specific methods
  getCurrentDeck(): number | null {
    return this.fusedPositioningService?.getCurrentDeck() || null;
  }

  getElevationAboveSeaLevel(): number | null {
    return this.fusedPositioningService?.getElevationAboveSeaLevel() || null;
  }

  getCruiseShipSettings(): any {
    return this.fusedPositioningService?.getCruiseShipSettings() || null;
  }

  isOnCruiseShip(): boolean {
    return !!this.enhancedConfig.shipConfiguration;
  }

  // Manual override method
  async forceShipMode(enable: boolean, shipConfig?: any): Promise<void> {
    if (!this.fusedPositioningService) return;

    this.enhancedConfig.shipConfiguration = enable ? {
      shipName: shipConfig?.shipName || 'Manual Vessel',
      deckCount: shipConfig?.deckCount || 12,
      seaLevelOffset: shipConfig?.seaLevelOffset || 15,
      enableMotionCompensation: true,
      enableDeckTracking: true,
      ...shipConfig
    } : undefined;

    // Reinitialize with new configuration
    this.initializeFusedPositioning();
    
    console.log(`Ship mode ${enable ? 'enabled' : 'disabled'} manually`);
  }
}

export default EnhancedMotionService;
