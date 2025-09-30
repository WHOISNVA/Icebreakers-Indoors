import MotionService from './MotionService';
import FusedPositioningService, { FusedPosition, CruiseShipSettings } from './FusedPositioningService';

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

  async stopEnhancedMonitoring(): Promise<void> {
    // Stop base motion monitoring
    await this.stopMonitoring();

    // Stop advanced positioning
    if (this.fusedPositioningService && this.fusedPositioningService.isActive()) {
      await this.fusedPositioningService.stopFusedPositioning();
      console.log('Enhanced motion monitoring stopped');
    }
  }

  getCurrentPosition(): FusedPosition | null {
    return this.fusedPositioningService?.getCurrentPosition() || null;
  }

  getPositionAccuracy(): number {
    const position = this.getCurrentPosition();
    return position?.accuracy || 10.0;
  }

  isIndoorMode(): boolean {
    const position = this.getCurrentPosition();
    return position?.metadata.indoorMode || false;
  }

  isCruiseMode(): boolean {
    const position = this.getCurrentPosition();
    return position?.metadata.cruiseMode || false;
  }

  getNearestBar(): any {
    return this.fusedPositioningService?.findNearestBar() || null;
  }

  optimizeDeliveryRoute(customerId: string): any {
    return this.fusedPositioningService?.optimizeDeliveryRoute(customerId) || null;
  }

  getQualityMetrics(): any {
    return this.fusedPositioningService?.getQualityMetrics() || {
      gnssSignalStrength: 0,
      vioConfidence: 0,
      beaconCoverage: 0,
      meshConnectivity: 0,
      overallAccuracy: 10.0
    };
  }

  isAdvancedPositioningActive(): boolean {
    return this.fusedPositioningService?.isActive() || false;
  }
}

export default EnhancedMotionService;
