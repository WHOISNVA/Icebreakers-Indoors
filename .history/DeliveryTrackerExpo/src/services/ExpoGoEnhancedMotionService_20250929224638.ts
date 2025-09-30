import ExpoGoMotionService, { ARPose } from './ExpoGoMotionService';
import FusedPositioningService, { FusedPosition, CruiseShipSettings } from './FusedPositioningService';
import ShipDetectionService, { ShipDetectionResult } from './ShipDetectionService';

// Expo Go compatible Enhanced Motion Service
export interface ExpoGoEnhancedMotionConfig {
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

export type MotionActivity = 'stationary' | 'walking' | 'running' | 'automotive' | 'unknown';

interface MotionData {
  activity: MotionActivity;
  confidence: number;
  timestamp: number;
}

class ExpoGoEnhancedMotionService {
  private fusedPositioningService: FusedPositioningService | null = null;
  private enhancedConfig: ExpoGoEnhancedMotionConfig;
  private isMonitoring: boolean = false;
  private lastActivity: MotionActivity = 'unknown';
  private motionService: ExpoGoMotionService | null = null;
  private activityDetectionInterval: any = null;

  constructor(config: ExpoGoEnhancedMotionConfig = {}) {
    this.enhancedConfig = {
      enableAdvancedPositioning: true,
      targetAccuracy: 1.0, // 1 meter target for all venues
      ...config
    };

    if (this.enhancedConfig.enableAdvancedPositioning) {
      this.initializeFusedPositioning();
    }

    // Initialize basic motion service
    this.motionService = new ExpoGoMotionService({
      onPoseUpdate: (pose: ARPose) => {
        console.log(`Motion pose update: confidence ${pose.confidence}`);
      }
    });
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
      cruiseShipMode: !!this.enhancedConfig.shipConfiguration,
      shipConfiguration: this.enhancedConfig.shipConfiguration
    });
  }

  async startEnhancedMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Enhanced motion monitoring already active');
      return;
    }

    this.isMonitoring = true;

    // Start motion service
    if (this.motionService) {
      try {
        await this.motionService.startVIOTracking();
      } catch (error) {
        console.warn('VIO tracking failed, continuing without motion detection:', error);
      }
    }

    // Start advanced positioning if enabled
    if (this.fusedPositioningService) {
      try {
        await this.fusedPositioningService.startFusedPositioning();
        console.log('Enhanced motion monitoring with advanced positioning started');
      } catch (error) {
        console.error('Failed to start advanced positioning, falling back to basic mode:', error);
      }
    }

    // Start simple activity detection
    this.startActivityDetection();
  }

  async startEnhancedMonitoringWithAutoDetection(): Promise<void> {
    // Auto-detect ship environment first
    const isShipDetected = await ShipDetectionService.detectShipEnvironment();
    
    if (isShipDetected.isOnShip) {
      console.log(`Ship environment detected: ${isShipDetected.detectionReason}`);
      
      // Enable ship configuration automatically
      this.enhancedConfig.shipConfiguration = {
        shipName: 'Auto-detected Vessel',
        deckCount: 12,
        seaLevelOffset: 15,
        enableMotionCompensation: true,
        enableDeckTracking: true
      };

      // Reinitialize positioning with ship config
      if (this.fusedPositioningService) {
        await this.fusedPositioningService.stopFusedPositioning();
        this.initializeFusedPositioning();
      }

      this.enhancedConfig.onCruiseShipDetected?.({
        shipHeading: 0,
        shipSpeed: 0,
        shipAcceleration: { x: 0, y: 0, z: 0, timestamp: Date.now() },
        platformDetected: true,
        shipGPSReference: {
          latitude: 0,
          longitude: 0,
          altitude: 0,
          timestamp: Date.now()
        },
        seaLevelElevation: 15,
        deckElevations: new Map(),
        shipDimensions: { length: 300, width: 35, height: 60 },
        shipMotionState: { roll: 0, pitch: 0, yaw: 0, heave: 0 }
      });
    }

    await this.startEnhancedMonitoring();
  }

  private startActivityDetection(): void {
    // Simple activity detection using position changes
    this.activityDetectionInterval = setInterval(() => {
      if (!this.fusedPositioningService) return;

      const currentPosition = this.fusedPositioningService.getCurrentPosition();
      if (currentPosition) {
        // Simple activity inference based on accuracy and positioning
        let activity: MotionActivity = 'unknown';
        let confidence = 0.5;

        if (currentPosition.accuracy < 5) {
          if (currentPosition.sources.some(s => s.type === 'beacon')) {
            activity = 'stationary';
            confidence = 0.8;
          } else if (currentPosition.sources.some(s => s.type === 'gnss')) {
            activity = 'walking';
            confidence = 0.6;
          }
        }

        if (activity !== this.lastActivity) {
          this.handleActivityTransition(this.lastActivity, activity, confidence);
          this.lastActivity = activity;
        }
      }
    }, 2000); // Check every 2 seconds
  }

  private handleActivityTransition(
    fromActivity: MotionActivity,
    toActivity: MotionActivity,
    confidence: number
  ): void {
    console.log(`Activity transition: ${fromActivity} → ${toActivity} (confidence: ${confidence})`);

    // Simulate motion change notification
    const motionData: MotionData = {
      activity: toActivity,
      confidence,
      timestamp: Date.now()
    };

    // This replaces the onMotionChange callback from the original MotionService
    console.log(`Detected motion activity: ${motionData.activity}`);
  }

  async stopEnhancedMonitoring(): Promise<void> {
    this.isMonitoring = false;

    if (this.motionService?.isTracking()) {
      await this.motionService.stopVIOTracking();
    }

    if (this.fusedPositioningService?.isActive()) {
      await this.fusedPositioningService.stopFusedPositioning();
    }

    if (this.activityDetectionInterval) {
      clearInterval(this.activityDetectionInterval);
      this.activityDetectionInterval = null;
    }

    console.log('Enhanced motion monitoring stopped');
  }

  async getCurrentSeaStatus(): Promise<ShipDetectionResult> {
    return await ShipDetectionService.detectShipEnvironment();
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
    await this.fusedPositioningService.stopFusedPositioning();
    this.initializeFusedPositioning();
    
    if (this.isMonitoring) {
      await this.fusedPositioningService.startFusedPositioning();
    }
    
    console.log(`Ship mode ${enable ? 'enabled' : 'disabled'} manually`);
  }

  getCurrentActivity(): MotionActivity {
    return this.lastActivity;
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  getFusedPositioningService(): FusedPositioningService | null {
    return this.fusedPositioningService;
  }
}

export default ExpoGoEnhancedMotionService;
