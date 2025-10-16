/**
 * IndoorAtlas AR Wayfinding Service
 * Provides access to IndoorAtlas's native AR wayfinding API
 */

import { NativeModules, Platform, NativeEventEmitter, EmitterSubscription } from 'react-native';

const { RNIndoorAtlasARModule, RNIndoorAtlasModule } = NativeModules;

export interface IAWaypoint {
  latitude: number;
  longitude: number;
  floor?: number;
}

export interface IARoute {
  waypoints: IAWaypoint[];
  length: number;
}

class IndoorAtlasARService {
  private isAvailable = false;
  private eventEmitter: NativeEventEmitter | null = null;
  private wayfindingListener: EmitterSubscription | null = null;

  constructor() {
    // AR wayfinding available on iOS with RNIndoorAtlasARModule
    // OR on Android with RNIndoorAtlasModule wayfinding API
    this.isAvailable = 
      (Platform.OS === 'ios' && !!RNIndoorAtlasARModule) ||
      (Platform.OS === 'android' && !!RNIndoorAtlasModule);
    
    if (!this.isAvailable) {
      console.log('⚠️ IndoorAtlas AR wayfinding not available on this platform');
    } else if (Platform.OS === 'android' && RNIndoorAtlasModule) {
      this.eventEmitter = new NativeEventEmitter(RNIndoorAtlasModule);
      console.log('✅ IndoorAtlas wayfinding available on Android');
    }
  }

  /**
   * Start AR wayfinding to a target location
   */
  async startARWayfinding(
    targetLat: number,
    targetLng: number,
    targetFloor?: number
  ): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('IndoorAtlas AR wayfinding not available');
      return false;
    }

    try {
      if (Platform.OS === 'ios' && RNIndoorAtlasARModule) {
        const result = await RNIndoorAtlasARModule.startARWayfinding(
          targetLat,
          targetLng,
          targetFloor ?? null
        );
        console.log('🎯 IndoorAtlas AR wayfinding started (iOS)');
        return result;
      } else if (Platform.OS === 'android' && RNIndoorAtlasModule) {
        const result = await RNIndoorAtlasModule.requestWayfinding(
          targetLat,
          targetLng,
          targetFloor ?? null
        );
        console.log('🎯 IndoorAtlas wayfinding started (Android)');
        return result;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to start AR wayfinding:', error);
      return false;
    }
  }

  /**
   * Stop AR wayfinding
   */
  async stopARWayfinding(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      if (Platform.OS === 'ios' && RNIndoorAtlasARModule) {
        const result = await RNIndoorAtlasARModule.stopARWayfinding();
        console.log('🛑 IndoorAtlas AR wayfinding stopped (iOS)');
        return result;
      } else if (Platform.OS === 'android' && RNIndoorAtlasModule) {
        const result = await RNIndoorAtlasModule.removeWayfinding();
        console.log('🛑 IndoorAtlas wayfinding stopped (Android)');
        return result;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to stop AR wayfinding:', error);
      return false;
    }
  }

  /**
   * Subscribe to wayfinding route updates
   */
  onWayfindingUpdate(callback: (route: IARoute) => void): () => void {
    if (!this.isAvailable || !this.eventEmitter) {
      return () => {};
    }

    this.wayfindingListener = this.eventEmitter.addListener(
      'IndoorAtlas:wayfindingUpdate',
      callback
    );

    return () => {
      this.wayfindingListener?.remove();
      this.wayfindingListener = null;
    };
  }

  /**
   * Check if AR wayfinding is available
   */
  isARWayfindingAvailable(): boolean {
    return this.isAvailable;
  }
}

export default new IndoorAtlasARService();

