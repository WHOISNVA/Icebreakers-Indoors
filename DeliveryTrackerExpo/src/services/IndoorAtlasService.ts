/**
 * IndoorAtlas Service
 * Provides indoor positioning with sub-meter accuracy
 * Falls back to GPS when IndoorAtlas is not configured
 * Supports both Android and iOS
 */

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { INDOORATLAS_CONFIG, isIndoorAtlasConfigured } from '../config/indooratlas';
import { nativeModule, eventEmitter, IndoorAtlasLocation } from './IndoorAtlasNativeModule';

export interface IAPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  floor: number | null;
  heading: number | null;
  timestamp: number;
  source: 'indooratlas' | 'gps';
}

class IndoorAtlasService {
  private isInitialized = false;
  private isIndoorAtlasAvailable = false;
  private locationSubscription: Location.LocationSubscription | null = null;
  private listeners: Array<(position: IAPosition) => void> = [];

  /**
   * Initialize IndoorAtlas service
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return this.isIndoorAtlasAvailable;
    }

    console.log(`🏢 Initializing IndoorAtlas Service on ${Platform.OS}...`);

    // Check if IndoorAtlas is configured and available
    if (isIndoorAtlasConfigured() && nativeModule) {
      try {
        // Initialize IndoorAtlas with API credentials
        await nativeModule.initialize(
          INDOORATLAS_CONFIG.API_KEY,
          INDOORATLAS_CONFIG.API_SECRET
        );
        
        this.isIndoorAtlasAvailable = true;
        this.isInitialized = true;
        console.log(`✅ IndoorAtlas initialized successfully on ${Platform.OS}`);
        return true;
      } catch (error) {
        console.error('❌ IndoorAtlas initialization failed:', error);
        this.isIndoorAtlasAvailable = false;
      }
    } else {
      const reason = !isIndoorAtlasConfigured() 
        ? 'not configured' 
        : 'native module not available';
      console.log(`📍 IndoorAtlas ${reason}, using GPS fallback`);
      this.isIndoorAtlasAvailable = false;
    }

    this.isInitialized = true;
    return this.isIndoorAtlasAvailable;
  }

  /**
   * Get current position (IndoorAtlas or GPS fallback)
   */
  async getCurrentPosition(): Promise<IAPosition> {
    await this.initialize();

    if (this.isIndoorAtlasAvailable && nativeModule) {
      try {
        const position: IndoorAtlasLocation = await nativeModule.getCurrentPosition();
        console.log('🏢 IndoorAtlas position:', position);
        
        return {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          altitude: null, // IndoorAtlas doesn't provide altitude
          floor: position.floor ?? null,
          heading: position.bearing ?? null,
          timestamp: position.timestamp,
          source: 'indooratlas',
        };
      } catch (error) {
        console.warn('⚠️ IndoorAtlas position failed, falling back to GPS:', error);
      }
    }

    // GPS fallback
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    console.log('📍 GPS position:', location);

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 10,
      altitude: location.coords.altitude,
      floor: null, // Will be estimated from altitude
      heading: location.coords.heading ?? null,
      timestamp: location.timestamp,
      source: 'gps',
    };
  }

  /**
   * Start watching position updates
   */
  async watchPosition(callback: (position: IAPosition) => void): Promise<() => void> {
    await this.initialize();

    this.listeners.push(callback);

    if (this.isIndoorAtlasAvailable && nativeModule) {
      try {
        // Start watching position updates
        nativeModule.startWatching();
        
        // Subscribe to location events
        let eventSubscription: any = null;
        if (eventEmitter) {
          eventSubscription = eventEmitter.addListener(
            'IndoorAtlas:locationChanged',
            (position: IndoorAtlasLocation) => {
              const iaPosition: IAPosition = {
                latitude: position.latitude,
                longitude: position.longitude,
                accuracy: position.accuracy,
                altitude: null,
                floor: position.floor ?? null,
                heading: position.bearing ?? null,
                timestamp: position.timestamp,
                source: 'indooratlas',
              };
              
              this.listeners.forEach(listener => listener(iaPosition));
            }
          );
        }

        console.log(`✅ IndoorAtlas position watching started on ${Platform.OS}`);

        return () => {
          this.listeners = this.listeners.filter(l => l !== callback);
          if (eventSubscription) {
            eventSubscription.remove();
          }
          if (nativeModule) {
            nativeModule.stopWatching();
          }
        };
      } catch (error) {
        console.warn('⚠️ IndoorAtlas watch failed, falling back to GPS:', error);
      }
    }

    // GPS fallback
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: INDOORATLAS_CONFIG.UPDATE_INTERVAL,
        distanceInterval: 1,
      },
      (location) => {
        const gpsPosition: IAPosition = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? 10,
          altitude: location.coords.altitude,
          floor: null,
          heading: location.coords.heading ?? null,
          timestamp: location.timestamp,
          source: 'gps',
        };

        this.listeners.forEach(listener => listener(gpsPosition));
      }
    );

    console.log('✅ GPS position watching started');

    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }
    };
  }

  /**
   * Stop watching position
   */
  stopWatchingPosition(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.isIndoorAtlasAvailable && nativeModule) {
      nativeModule.stopWatching();
    }

    this.listeners = [];
    console.log('🛑 Position watching stopped');
  }

  /**
   * Check if using IndoorAtlas or GPS
   */
  isUsingIndoorAtlas(): boolean {
    return this.isIndoorAtlasAvailable;
  }
}

export default new IndoorAtlasService();


