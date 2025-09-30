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
      uwb: 'UWB positioning unavailable in Expo Go. Using GPS/WiFi positioning.',
      bleBeacon: 'BLE beacon scanning limited in Expo Go. Using simulated beacons.',
      backgroundLocation: 'Background location limited in Expo Go. Keep app in foreground.',
      ar: 'AR features unavailable in Expo Go. Using sensor-based positioning.'
    };
    
    return messages[feature] || `${feature} has limited support in Expo Go.`;
  }
}

export default ExpoGoCompatibilityService;
