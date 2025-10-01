import { LocationData } from './LocationService';

export interface Zone {
  id: string;
  name: string;
  type: 'restaurant' | 'pool_deck' | 'casino_floor' | 'lobby' | 'bar' | 'other';
  center: {
    latitude: number;
    longitude: number;
  };
  radius: number; // meters
  floor?: number;
  description?: string;
}

export interface MatchedLocation extends LocationData {
  matchedZone?: Zone;
  isMatched: boolean;
  distanceToZone?: number; // meters
  confidence: number; // 0-1
}

class MapMatchingService {
  private zones: Zone[] = [];

  constructor() {
    this.initializeDefaultZones();
  }

  /**
   * Initialize default zones for common areas
   */
  private initializeDefaultZones(): void {
    // Example zones - these would typically come from a database or configuration
    this.zones = [
      {
        id: 'main_restaurant',
        name: 'Main Restaurant',
        type: 'restaurant',
        center: { latitude: 37.78825, longitude: -122.4324 },
        radius: 50,
        floor: 1,
        description: 'Main dining area',
      },
      {
        id: 'pool_deck',
        name: 'Pool Deck',
        type: 'pool_deck',
        center: { latitude: 37.78925, longitude: -122.4334 },
        radius: 75,
        floor: 2,
        description: 'Outdoor pool area',
      },
      {
        id: 'casino_floor',
        name: 'Casino Floor',
        type: 'casino_floor',
        center: { latitude: 37.78725, longitude: -122.4314 },
        radius: 100,
        floor: 1,
        description: 'Gaming area',
      },
      {
        id: 'lobby',
        name: 'Main Lobby',
        type: 'lobby',
        center: { latitude: 37.78875, longitude: -122.4329 },
        radius: 30,
        floor: 1,
        description: 'Hotel lobby',
      },
      {
        id: 'sports_bar',
        name: 'Sports Bar',
        type: 'bar',
        center: { latitude: 37.78775, longitude: -122.4339 },
        radius: 40,
        floor: 1,
        description: 'Sports bar and grill',
      },
    ];
  }

  /**
   * Add a new zone
   */
  public addZone(zone: Zone): void {
    this.zones.push(zone);
  }

  /**
   * Remove a zone
   */
  public removeZone(zoneId: string): void {
    this.zones = this.zones.filter(zone => zone.id !== zoneId);
  }

  /**
   * Get all zones
   */
  public getZones(): Zone[] {
    return [...this.zones];
  }

  /**
   * Get zones by type
   */
  public getZonesByType(type: Zone['type']): Zone[] {
    return this.zones.filter(zone => zone.type === type);
  }

  /**
   * Match a location to the nearest zone
   */
  public matchLocation(location: LocationData): MatchedLocation {
    let bestMatch: Zone | null = null;
    let bestDistance = Infinity;
    let bestConfidence = 0;

    for (const zone of this.zones) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        zone.center.latitude,
        zone.center.longitude
      );

      if (distance <= zone.radius) {
        // Location is within zone radius
        const confidence = this.calculateConfidence(distance, zone.radius, location.accuracy);
        
        if (confidence > bestConfidence) {
          bestMatch = zone;
          bestDistance = distance;
          bestConfidence = confidence;
        }
      }
    }

    const matchedLocation: MatchedLocation = {
      ...location,
      isMatched: bestMatch !== null,
      matchedZone: bestMatch || undefined,
      distanceToZone: bestMatch ? bestDistance : undefined,
      confidence: bestConfidence,
    };

    return matchedLocation;
  }

  /**
   * Find the nearest zone to a location
   */
  public findNearestZone(location: LocationData): { zone: Zone; distance: number } | null {
    let nearestZone: Zone | null = null;
    let nearestDistance = Infinity;

    for (const zone of this.zones) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        zone.center.latitude,
        zone.center.longitude
      );

      if (distance < nearestDistance) {
        nearestZone = zone;
        nearestDistance = distance;
      }
    }

    return nearestZone ? { zone: nearestZone, distance: nearestDistance } : null;
  }

  /**
   * Snap location to the center of the matched zone
   */
  public snapToZone(location: LocationData): LocationData {
    const matched = this.matchLocation(location);
    
    if (matched.matchedZone) {
      return {
        ...location,
        latitude: matched.matchedZone.center.latitude,
        longitude: matched.matchedZone.center.longitude,
        accuracy: Math.min(location.accuracy, 5), // Improve accuracy when snapped
      };
    }

    return location;
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate confidence score for zone matching
   */
  private calculateConfidence(distance: number, zoneRadius: number, locationAccuracy: number): number {
    // Base confidence from distance within zone
    const distanceConfidence = Math.max(0, 1 - (distance / zoneRadius));
    
    // Accuracy confidence (better accuracy = higher confidence)
    const accuracyConfidence = Math.max(0, 1 - (locationAccuracy / 50)); // 50m accuracy threshold
    
    // Combined confidence
    return (distanceConfidence * 0.7 + accuracyConfidence * 0.3);
  }

  /**
   * Get zone information by ID
   */
  public getZoneById(zoneId: string): Zone | null {
    return this.zones.find(zone => zone.id === zoneId) || null;
  }

  /**
   * Update zone information
   */
  public updateZone(zoneId: string, updates: Partial<Zone>): boolean {
    const zoneIndex = this.zones.findIndex(zone => zone.id === zoneId);
    if (zoneIndex !== -1) {
      this.zones[zoneIndex] = { ...this.zones[zoneIndex], ...updates };
      return true;
    }
    return false;
  }
}

export default new MapMatchingService();






