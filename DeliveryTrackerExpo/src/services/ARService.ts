/**
 * AR Service
 * Cross-platform TypeScript wrapper for native AR modules
 * iOS: ARKit, Android: ARCore
 * Provides 3D AR navigation with arrows and path visualization
 */

import { NativeModules, Platform } from 'react-native';

interface ARModule {
  initializeAR(): Promise<boolean>;
  cleanup(): Promise<boolean>;
  placeDirectionalArrow(bearing: number, distance: number): Promise<boolean>;
  drawPathToTarget(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<boolean>;
}

// Platform-specific native module selection
const ARNativeModule: ARModule | undefined = 
  Platform.OS === 'ios' 
    ? NativeModules.RNARKitModule 
    : Platform.OS === 'android'
    ? NativeModules.RNARCoreModule
    : undefined;

class ARService {
  private isInitialized = false;

  /**
   * Check if AR is available on this device
   * Returns true for iOS (ARKit) or Android (ARCore) if module is loaded
   */
  isAvailable(): boolean {
    return !!ARNativeModule;
  }

  /**
   * Get the platform-specific AR framework name
   */
  getARFramework(): string {
    if (Platform.OS === 'ios') return 'ARKit';
    if (Platform.OS === 'android') return 'ARCore';
    return 'None';
  }

  /**
   * Initialize AR session
   * Throws error if AR is not available
   */
  async initializeAR(): Promise<boolean> {
    if (!ARNativeModule) {
      throw new Error(`AR not available on ${Platform.OS}`);
    }

    try {
      const success = await ARNativeModule.initializeAR();
      this.isInitialized = success;
      console.log(`✅ ${this.getARFramework()} initialized successfully`);
      return success;
    } catch (error: any) {
      console.error(`❌ Failed to initialize ${this.getARFramework()}:`, error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Cleanup AR session and remove all nodes
   */
  async cleanup(): Promise<boolean> {
    if (!ARNativeModule) {
      return false;
    }

    try {
      const success = await ARNativeModule.cleanup();
      this.isInitialized = false;
      console.log(`✅ ${this.getARFramework()} cleaned up`);
      return success;
    } catch (error) {
      console.error(`❌ Failed to cleanup ${this.getARFramework()}:`, error);
      return false;
    }
  }

  /**
   * Place a 3D directional arrow pointing toward target
   * @param bearing - Direction in degrees (0-360, where 0 is north)
   * @param distance - Distance to target in meters
   */
  async placeDirectionalArrow(bearing: number, distance: number): Promise<boolean> {
    if (!ARNativeModule || !this.isInitialized) {
      console.warn(`⚠️ ${this.getARFramework()} not initialized`);
      return false;
    }

    try {
      const success = await ARNativeModule.placeDirectionalArrow(bearing, distance);
      return success;
    } catch (error) {
      console.error('❌ Failed to place directional arrow:', error);
      return false;
    }
  }

  /**
   * Draw a 3D path line from current position to target
   * @param fromLat - Current latitude
   * @param fromLng - Current longitude
   * @param toLat - Target latitude
   * @param toLng - Target longitude
   */
  async drawPathToTarget(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): Promise<boolean> {
    if (!ARNativeModule || !this.isInitialized) {
      console.warn(`⚠️ ${this.getARFramework()} not initialized`);
      return false;
    }

    try {
      const success = await ARNativeModule.drawPathToTarget(fromLat, fromLng, toLat, toLng);
      return success;
    } catch (error) {
      console.error('❌ Failed to draw path:', error);
      return false;
    }
  }

  /**
   * Check if AR session is currently running
   */
  isRunning(): boolean {
    return this.isInitialized;
  }
}

export default new ARService();

