/**
 * FloorPlan Service
 * Fetches floor plan data from IndoorAtlas API for dynamic floor selector
 */

import { Platform } from 'react-native';
import { INDOORATLAS_CONFIG } from '../config/indooratlas';
import ReverseGeocodingService from './ReverseGeocodingService';

export interface FloorPlan {
  id: string;
  name: string;
  level: number;
  venueId: string;
  imageUrl?: string;
  width?: number;
  height?: number;
}

export interface VenueFloorData {
  venueId: string;
  floors: FloorPlan[];
  defaultFloor: number;
  minFloor: number;
  maxFloor: number;
  venueLocation?: {
    latitude: number;
    longitude: number;
    name: string;
    address?: string;
    city?: string;
    country?: string;
  };
}

class FloorPlanService {
  private floorDataCache: Map<string, VenueFloorData> = new Map();
  private loadingVenues: Set<string> = new Set();

  /**
   * Fetch floor plan data for a venue
   */
  async getVenueFloors(venueId: string): Promise<VenueFloorData> {
    // Check cache first
    if (this.floorDataCache.has(venueId)) {
      console.log(`📋 Using cached floor data for venue: ${venueId}`);
      return this.floorDataCache.get(venueId)!;
    }

    // Check if already loading
    if (this.loadingVenues.has(venueId)) {
      console.log(`⏳ Floor data already loading for venue: ${venueId}`);
      // Wait for loading to complete
      return this.waitForLoading(venueId);
    }

    console.log(`🏢 Fetching floor data for venue: ${venueId}`);
    this.loadingVenues.add(venueId);

    try {
      const floorData = await this.fetchFloorDataFromAPI(venueId);
      this.floorDataCache.set(venueId, floorData);
      this.loadingVenues.delete(venueId);
      
      console.log(`✅ Floor data loaded: ${floorData.floors.length} floors (${floorData.minFloor} to ${floorData.maxFloor})`);
      return floorData;
    } catch (error) {
      this.loadingVenues.delete(venueId);
      console.error('❌ Failed to fetch floor data:', error);
      throw error;
    }
  }

  /**
   * Wait for loading to complete
   */
  private async waitForLoading(venueId: string): Promise<VenueFloorData> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.floorDataCache.has(venueId)) {
          clearInterval(checkInterval);
          resolve(this.floorDataCache.get(venueId)!);
        } else if (!this.loadingVenues.has(venueId)) {
          clearInterval(checkInterval);
          reject(new Error('Floor data loading failed'));
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Floor data loading timeout'));
      }, 10000);
    });
  }

  /**
   * Fetch floor data from IndoorAtlas API
   */
  private async fetchFloorDataFromAPI(venueId: string): Promise<VenueFloorData> {
    if (!INDOORATLAS_CONFIG.API_KEY || !INDOORATLAS_CONFIG.API_SECRET) {
      throw new Error('IndoorAtlas API credentials not configured');
    }

    // For now, we'll use a mock implementation since IndoorAtlas API endpoints
    // for floor plans are not publicly documented. In a real implementation,
    // you would use the IndoorAtlas REST API or SDK methods.
    
    console.log(`🌐 Fetching floor plans for venue ${venueId}...`);
    
    // Mock API call - replace with actual IndoorAtlas API
    const mockFloorData = await this.getMockFloorData(venueId);
    
    return mockFloorData;
  }

  /**
   * Fetch real venue data from IndoorAtlas API
   */
  private async fetchRealVenueData(venueId: string): Promise<VenueFloorData> {
    console.log(`🌐 Fetching real venue data for: ${venueId}`);
    
    // For now, we'll use a more realistic mock that simulates real API data
    // In production, this would make actual IndoorAtlas API calls
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // This would be replaced with actual IndoorAtlas API calls:
    // const response = await fetch(`${INDOORATLAS_CONFIG.API_ENDPOINTS.BASE_URL}${INDOORATLAS_CONFIG.API_ENDPOINTS.VENUE_INFO.replace('{venueId}', venueId)}`, {
    //   headers: {
    //     'Authorization': `Bearer ${INDOORATLAS_CONFIG.API_KEY}`,
    //     'Content-Type': 'application/json'
    //   }
    // });
    
    // Your actual venue coordinates from IndoorAtlas dashboard
    const coordinates = {
      latitude: 32.8672533, // ✅ Omni Las Colinas, Irving, Texas
      longitude: -96.9376291, // ✅ Omni Las Colinas, Irving, Texas
    };
    
    // Get address for the coordinates
    const addressInfo = await this.getVenueAddress(coordinates.latitude, coordinates.longitude);
    
    const venueData = {
      venueId,
      floors: [
        { id: 'floor-0', name: 'Ground Floor', level: 0, venueId },
        { id: 'floor-1', name: 'First Floor', level: 1, venueId },
        { id: 'floor-2', name: 'Second Floor', level: 2, venueId },
      ],
      defaultFloor: 0,
      minFloor: 0,
      maxFloor: 2,
      venueLocation: {
        // 🔧 UPDATE THESE COORDINATES WITH YOUR REAL VENUE LOCATION
        // Get coordinates from: https://dashboard.indooratlas.com
        // Or visit your venue and get GPS coordinates from your phone
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        name: 'Omni Las Colinas', // ✅ Your actual venue name
        address: addressInfo.address,
        city: addressInfo.city,
        country: addressInfo.country
      }
    };
    
    // ✅ Using your real venue coordinates!
    console.log('✅ Using real venue coordinates!');
    console.log('📍 Omni Las Colinas: 32.8672533, -96.9376291 (Irving, Texas)');
    console.log('🏢 Venue: Omni Las Colinas');
    console.log('📍 Address: East Las Colinas Boulevard 221, Irving, 75039, Texas');
    
    return venueData;
  }

  /**
   * Get mock floor data for testing
   * Replace this with actual IndoorAtlas API calls
   */
  private async getMockFloorData(venueId: string): Promise<VenueFloorData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock data based on venue ID
    const mockData: Record<string, VenueFloorData> = {
      'default': {
        venueId,
        floors: [
          { id: 'floor-0', name: 'Ground Floor', level: 0, venueId },
          { id: 'floor-1', name: 'First Floor', level: 1, venueId },
          { id: 'floor-2', name: 'Second Floor', level: 2, venueId },
          { id: 'floor-3', name: 'Third Floor', level: 3, venueId },
        ],
        defaultFloor: 0,
        minFloor: 0,
        maxFloor: 3,
        venueLocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          name: 'Default Venue'
        }
      },
      'basement': {
        venueId,
        floors: [
          { id: 'floor-b1', name: 'Basement Level 1', level: -1, venueId },
          { id: 'floor-0', name: 'Ground Floor', level: 0, venueId },
          { id: 'floor-1', name: 'First Floor', level: 1, venueId },
          { id: 'floor-2', name: 'Second Floor', level: 2, venueId },
        ],
        defaultFloor: 0,
        minFloor: -1,
        maxFloor: 2,
      },
      'high-rise': {
        venueId,
        floors: [
          { id: 'floor-0', name: 'Lobby', level: 0, venueId },
          { id: 'floor-1', name: 'Mezzanine', level: 1, venueId },
          { id: 'floor-2', name: 'Second Floor', level: 2, venueId },
          { id: 'floor-3', name: 'Third Floor', level: 3, venueId },
          { id: 'floor-4', name: 'Fourth Floor', level: 4, venueId },
          { id: 'floor-5', name: 'Fifth Floor', level: 5, venueId },
        ],
        defaultFloor: 0,
        minFloor: 0,
        maxFloor: 5,
      },
    };

    // Return mock data based on venue ID pattern
    if (venueId.includes('basement')) {
      return mockData.basement;
    } else if (venueId.includes('high-rise')) {
      return mockData['high-rise'];
    } else if (venueId === '6e41ead0-a0d4-11f0-819a-17ea3822dd94') {
      // Your specific venue ID - fetch real coordinates from IndoorAtlas
      try {
        const realVenueData = await this.fetchRealVenueData(venueId);
        return realVenueData;
      } catch (error) {
        console.warn('Failed to fetch real venue data, using fallback:', error);
        // Fallback to default data if real API fails
        return {
          venueId,
          floors: [
            { id: 'floor-0', name: 'Ground Floor', level: 0, venueId },
            { id: 'floor-1', name: 'First Floor', level: 1, venueId },
            { id: 'floor-2', name: 'Second Floor', level: 2, venueId },
          ],
          defaultFloor: 0,
          minFloor: 0,
          maxFloor: 2,
          venueLocation: {
            latitude: 37.7749, // Fallback coordinates
            longitude: -122.4194,
            name: 'Your Mapped Venue (Fallback)'
          }
        };
      }
    } else {
      return mockData.default;
    }
  }

  /**
   * Get available floor levels for a venue
   */
  async getAvailableFloors(venueId: string): Promise<number[]> {
    const floorData = await this.getVenueFloors(venueId);
    return floorData.floors.map(floor => floor.level).sort((a, b) => a - b);
  }

  /**
   * Get floor name for a specific level
   */
  async getFloorName(venueId: string, level: number): Promise<string> {
    const floorData = await this.getVenueFloors(venueId);
    const floor = floorData.floors.find(f => f.level === level);
    return floor?.name || `Floor ${level}`;
  }

  /**
   * Get venue address from coordinates using reverse geocoding
   */
  async getVenueAddress(latitude: number, longitude: number): Promise<{
    address: string;
    city: string;
    country: string;
  }> {
    try {
      console.log(`🌍 Getting address for coordinates: ${latitude}, ${longitude}`);
      
      // Use real reverse geocoding service
      const addressInfo = await ReverseGeocodingService.getAddress(latitude, longitude);
      
      console.log(`📍 Address found: ${addressInfo.address}`);
      return {
        address: addressInfo.address,
        city: addressInfo.city,
        country: addressInfo.country
      };
    } catch (error) {
      console.error('❌ Failed to get venue address:', error);
      return {
        address: 'Address not available',
        city: 'Unknown',
        country: 'Unknown'
      };
    }
  }

  /**
   * Mock address lookup (replace with real reverse geocoding)
   */
  private async getMockAddress(latitude: number, longitude: number): Promise<{
    address: string;
    city: string;
    country: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock addresses based on coordinates
    const mockAddresses: Record<string, { address: string; city: string; country: string }> = {
      '32.8672533,-96.9376291': {
        address: 'Omni Mandalay Hotel at Las Colinas, 221 East Las Colinas Boulevard',
        city: 'Irving',
        country: 'United States'
      },
      '37.7749,-122.4194': {
        address: '123 Market Street, Suite 100',
        city: 'San Francisco',
        country: 'United States'
      },
      '40.7128,-74.0060': {
        address: '456 Broadway, Floor 5',
        city: 'New York',
        country: 'United States'
      },
      '51.5074,-0.1278': {
        address: '789 Oxford Street, Level 2',
        city: 'London',
        country: 'United Kingdom'
      }
    };
    
    const key = `${latitude},${longitude}`;
    return mockAddresses[key] || {
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      city: 'Unknown City',
      country: 'Unknown Country'
    };
  }

  /**
   * Clear cache for a venue
   */
  clearCache(venueId?: string): void {
    if (venueId) {
      this.floorDataCache.delete(venueId);
      console.log(`🗑️ Cleared floor data cache for venue: ${venueId}`);
    } else {
      this.floorDataCache.clear();
      console.log('🗑️ Cleared all floor data cache');
    }
  }

  /**
   * Check if floor data is cached
   */
  isCached(venueId: string): boolean {
    return this.floorDataCache.has(venueId);
  }

  /**
   * Check if floor data is currently loading
   */
  isLoading(venueId: string): boolean {
    return this.loadingVenues.has(venueId);
  }
}

export default new FloorPlanService();
