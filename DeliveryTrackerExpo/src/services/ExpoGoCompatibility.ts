import Constants from 'expo-constants';
import * as Device from 'expo-device';

export interface CompatibilityStatus {
  isExpoGo: boolean;
  uwbSupported: boolean;
  bleBeaconSupported: boolean;
  backgroundLocationSupported: boolean;
  barometerSupported: boolean;
  arSupported: boolean;
}

class ExpoGoCompatibilityService {
  private static instance: ExpoGoCompatibilityService;
  private status: CompatibilityStatus;

  static getInstance(): ExpoGoCompatibilityService {
    if (!ExpoGoCompatibilityService.instance) {
      ExpoGoCompatibilityService.instance = new ExpoGoCompatibilityService();
    }
    return ExpoGoCompatibilityService.instance;
  }

  constructor() {
    this.status = this.detectCapabilities();
  }

  private detectCapabilities(): CompatibilityStatus {
    const isExpoGo = Constants.appOwnership === 'expo';
    
    return {
      isExpoGo,
      // UWB requires native modules not available in Expo Go
      uwbSupported: !isExpoGo && (Device.modelName?.includes('iPhone') || false),
      // BLE beacon scanning is limited in Expo Go
      bleBeaconSupported: !isExpoGo,
      // Background location has limitations in Expo Go
      backgroundLocationSupported: !isExpoGo,
      // Barometer is supported in Expo Go
      barometerSupported: true,
      // AR features require native modules
      arSupported: !isExpoGo
    };
  }

  getStatus(): CompatibilityStatus {
    return this.status;
  }

  isExpoGo(): boolean {
    return this.status.isExpoGo;
  }

  // Mock data generators for testing in Expo Go
  generateMockUWBData(): any {
    return {
      distance: Math.random() * 10 + 0.5, // 0.5-10.5 meters
      azimuth: Math.random() * 360,
      elevation: Math.random() * 90 - 45,
      accuracy: Math.random() * 0.5 + 0.1, // 0.1-0.6 meters
      timestamp: Date.now()
    };
  }

  generateMockBeaconData(): any {
    return {
      uuid: 'mock-beacon-' + Math.floor(Math.random() * 1000),
      major: Math.floor(Math.random() * 65535),
      minor: Math.floor(Math.random() * 65535),
      rssi: -Math.floor(Math.random() * 40 + 40), // -40 to -80 dBm
      accuracy: Math.random() * 5 + 1, // 1-6 meters
      proximity: ['immediate', 'near', 'far'][Math.floor(Math.random() * 3)]
    };
  }

  generateMockARFeatures(): any {
    return {
      features: Array.from({ length: 5 }, (_, i) => ({
        id: `feature-${i}`,
        position: {
          x: Math.random() * 10 - 5,
          y: Math.random() * 10 - 5,
          z: Math.random() * 10 - 5
        },
        confidence: Math.random() * 0.3 + 0.7
      })),
      trackingState: 'normal',
      lightEstimate: {
        ambientIntensity: 1000,
        ambientColorTemperature: 6500
      }
    };
  }

  // Logging helper for development
  logCompatibilityWarning(feature: string): void {
    if (this.isExpoGo()) {
      console.warn(
        `⚠️ ${feature} is not fully supported in Expo Go. ` +
        `Using mock data for testing. ` +
        `Build a custom development client for full functionality.`
      );
    }
  }

  // Get recommended fallback message for UI
  getFallbackMessage(feature: string): string {
    const messages: Record<string, string> = {
      uwb: 'UWB positioning requires a custom development build. See NATIVE_MODULES_SETUP.md for instructions.',
      bleBeacon: 'Full BLE beacon scanning requires a custom build. Limited functionality available.',
      backgroundLocation: 'Background location requires a custom build. Keep app in foreground for continuous tracking.',
      ar: 'AR features require a custom build with ARKit/ARCore. Using sensor-based positioning instead.'
    };
    
    return messages[feature] || `${feature} requires a custom development build for full functionality.`;
  }
}

export default ExpoGoCompatibilityService;
