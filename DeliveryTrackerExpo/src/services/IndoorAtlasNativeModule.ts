/**
 * IndoorAtlas Native Module Interface
 * Unified interface for both Android and iOS native modules
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

interface IndoorAtlasLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  floor?: number;
  timestamp: number;
  bearing?: number;
}

interface IndoorAtlasNativeModule {
  initialize: (apiKey: string, apiSecret: string) => Promise<boolean>;
  getCurrentPosition: () => Promise<IndoorAtlasLocation>;
  startWatching: () => void;
  stopWatching: () => void;
}

// Get the native module based on platform
let nativeModule: IndoorAtlasNativeModule | null = null;
let eventEmitter: NativeEventEmitter | null = null;

try {
  // Use our custom native module for both Android and iOS
  const { RNIndoorAtlasModule } = NativeModules;
  if (RNIndoorAtlasModule) {
    nativeModule = RNIndoorAtlasModule;
    eventEmitter = new NativeEventEmitter(RNIndoorAtlasModule);
    console.log('✅ IndoorAtlas native module loaded successfully');
  } else {
    console.log('⚠️ RNIndoorAtlasModule not found in NativeModules');
  }
} catch (error) {
  console.log('⚠️ IndoorAtlas native module not available:', error);
}

export { nativeModule, eventEmitter };
export type { IndoorAtlasLocation, IndoorAtlasNativeModule };
