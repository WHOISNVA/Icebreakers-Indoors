/**
 * IndoorAtlas AR Wayfinding Service
 * Provides access to IndoorAtlas's native AR wayfinding API
 */

import { NativeModules, Platform } from 'react-native';

const { RNIndoorAtlasARModule } = NativeModules;

class IndoorAtlasARService {
  private isAvailable = false;

  constructor() {
    this.isAvailable = Platform.OS === 'ios' && !!RNIndoorAtlasARModule;
    
    if (!this.isAvailable) {
      console.log('⚠️ IndoorAtlas AR wayfinding not available on this platform');
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
      console.warn('IndoorAtlas AR module not available');
      return false;
    }

    try {
      const result = await RNIndoorAtlasARModule.startARWayfinding(
        targetLat,
        targetLng,
        targetFloor ?? null
      );
      console.log('🎯 IndoorAtlas AR wayfinding started');
      return result;
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
      const result = await RNIndoorAtlasARModule.stopARWayfinding();
      console.log('🛑 IndoorAtlas AR wayfinding stopped');
      return result;
    } catch (error) {
      console.error('❌ Failed to stop AR wayfinding:', error);
      return false;
    }
  }

  /**
   * Check if AR wayfinding is available
   */
  isARWayfindingAvailable(): boolean {
    return this.isAvailable;
  }
}

export default new IndoorAtlasARService();

