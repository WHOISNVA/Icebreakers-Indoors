import * as Location from 'expo-location';
import { Barometer } from 'expo-sensors';

// 3D Venue Mapping and Zone Management System
export interface Point3D {
  x: number;
  y: number;
  z: number; // elevation/floor level
}

export interface Zone3D {
  id: string;
  name: string;
  type: 'bar' | 'seating' | 'kitchen' | 'restroom' | 'entrance' | 'deck' | 'cabin' | 'pool' | 'dining';
  bounds: Point3D[];
  floor: number;
  beaconUUIDs: string[];
  uwbAnchorIds: string[];
  priority: number; // for delivery routing
  capacity: number;
  isActive: boolean;
  metadata: {
    description?: string;
    staffAssigned?: string[];
    operatingHours?: { start: string; end: string };
    specialInstructions?: string;
  };
}

export interface Venue3DModel {
  id: string;
  name: string;
  type: 'restaurant' | 'bar' | 'cruise_ship' | 'hotel' | 'resort';
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  floors: Floor3D[];
  zones: Zone3D[];
  beacons: BeaconAnchor[];
  uwbAnchors: UWBAnchor[];
  referencePoint: {
    lat: number;
    lng: number;
    altitude: number;
  };
  coordinateSystem: 'local' | 'gps' | 'hybrid';
  lastUpdated: number;
}

export interface Floor3D {
  level: number;
  name: string;
  elevation: number; // meters above reference point
  floorPlan?: string; // base64 image or URL
  zones: string[]; // zone IDs on this floor
  isAccessible: boolean;
}

export interface BeaconAnchor {
  uuid: string;
  major: number;
  minor: number;
  position: Point3D;
  transmitPower: number;
  isActive: boolean;
  batteryLevel?: number;
  lastSeen?: number;
  zoneId?: string;
}

export interface UWBAnchor {
  id: string;
  position: Point3D;
  isActive: boolean;
  accuracy: number; // meters
  lastCalibrated: number;
  zoneId?: string;
}

export interface UserPosition3D {
  position: Point3D;
  floor: number;
  zoneId?: string;
  accuracy: number;
  timestamp: number;
  source: 'gps' | 'beacon' | 'uwb' | 'vio' | 'fused';
  confidence: number;
  nearestBeacons: string[];
  nearestUWBAnchors: string[];
}

export interface DeliveryRoute3D {
  fromZone: string;
  toZone: string;
  waypoints: Point3D[];
  estimatedTime: number; // seconds
  difficulty: 'easy' | 'medium' | 'hard';
  instructions: string[];
  avoidZones?: string[];
}

class Venue3DMapService {
  private static instance: Venue3DMapService;
  private currentVenue: Venue3DModel | null = null;
  private userPosition: UserPosition3D | null = null;
  private barometerSubscription: any = null;
  private lastBarometerReading: number = 0;
  private floorDetectionEnabled: boolean = false;
  private mapMatchingEnabled: boolean = true;

  static getInstance(): Venue3DMapService {
    if (!Venue3DMapService.instance) {
      Venue3DMapService.instance = new Venue3DMapService();
    }
    return Venue3DMapService.instance;
  }

  // === VENUE MANAGEMENT ===
  
  async createVenue(venueData: Partial<Venue3DModel>): Promise<Venue3DModel> {
    const venue: Venue3DModel = {
      id: venueData.id || `venue_${Date.now()}`,
      name: venueData.name || 'New Venue',
      type: venueData.type || 'restaurant',
      bounds: venueData.bounds || {
        minX: 0, maxX: 100,
        minY: 0, maxY: 100,
        minZ: 0, maxZ: 20
      },
      floors: venueData.floors || [this.createDefaultFloor(0)],
      zones: venueData.zones || [],
      beacons: venueData.beacons || [],
      uwbAnchors: venueData.uwbAnchors || [],
      referencePoint: venueData.referencePoint || {
        lat: 0, lng: 0, altitude: 0
      },
      coordinateSystem: venueData.coordinateSystem || 'local',
      lastUpdated: Date.now()
    };

    this.currentVenue = venue;
    console.log(`Created 3D venue: ${venue.name}`);
    return venue;
  }

  private createDefaultFloor(level: number): Floor3D {
    return {
      level,
      name: level === 0 ? 'Ground Floor' : `Floor ${level}`,
      elevation: level * 3.5, // 3.5m per floor
      zones: [],
      isAccessible: true
    };
  }

  async loadVenue(venueId: string): Promise<Venue3DModel | null> {
    // In a real app, this would load from a database
    console.log(`Loading venue: ${venueId}`);
    
    // Create sample cruise ship venue for demonstration
    if (venueId === 'cruise_ship_sample') {
      return this.createSampleCruiseShip();
    }
    
    // Create sample restaurant venue
    if (venueId === 'restaurant_sample') {
      return this.createSampleRestaurant();
    }

    return null;
  }

  private async createSampleCruiseShip(): Promise<Venue3DModel> {
    const cruiseShip: Venue3DModel = {
      id: 'cruise_ship_sample',
      name: 'Royal Caribbean Explorer',
      type: 'cruise_ship',
      bounds: {
        minX: -150, maxX: 150,
        minY: -50, maxY: 50,
        minZ: 0, maxZ: 80
      },
      floors: [
        { level: 3, name: 'Deck 3 - Dining', elevation: 10, zones: ['dining_main', 'kitchen_1'], isAccessible: true },
        { level: 5, name: 'Deck 5 - Promenade', elevation: 18, zones: ['bar_central', 'shops'], isAccessible: true },
        { level: 7, name: 'Deck 7 - Pool', elevation: 26, zones: ['pool_bar', 'pool_deck'], isAccessible: true },
        { level: 9, name: 'Deck 9 - Sports', elevation: 34, zones: ['sports_bar'], isAccessible: true },
        { level: 11, name: 'Deck 11 - Sky Bar', elevation: 42, zones: ['sky_bar'], isAccessible: true }
      ],
      zones: [
        {
          id: 'dining_main',
          name: 'Main Dining Room',
          type: 'dining',
          bounds: [
            { x: -80, y: -30, z: 10 },
            { x: 80, y: 30, z: 13 }
          ],
          floor: 3,
          beaconUUIDs: ['dining-beacon-1', 'dining-beacon-2'],
          uwbAnchorIds: ['uwb-dining-1', 'uwb-dining-2'],
          priority: 2,
          capacity: 200,
          isActive: true,
          metadata: {
            description: 'Main dining room with formal service',
            operatingHours: { start: '18:00', end: '22:00' }
          }
        },
        {
          id: 'bar_central',
          name: 'Central Promenade Bar',
          type: 'bar',
          bounds: [
            { x: -20, y: -10, z: 18 },
            { x: 20, y: 10, z: 21 }
          ],
          floor: 5,
          beaconUUIDs: ['bar-beacon-1'],
          uwbAnchorIds: ['uwb-bar-1'],
          priority: 1,
          capacity: 50,
          isActive: true,
          metadata: {
            description: 'Central bar on promenade deck',
            staffAssigned: ['bartender-1', 'server-1'],
            operatingHours: { start: '10:00', end: '02:00' }
          }
        },
        {
          id: 'pool_bar',
          name: 'Pool Deck Bar',
          type: 'bar',
          bounds: [
            { x: -30, y: 20, z: 26 },
            { x: 30, y: 40, z: 29 }
          ],
          floor: 7,
          beaconUUIDs: ['pool-beacon-1'],
          uwbAnchorIds: ['uwb-pool-1'],
          priority: 1,
          capacity: 30,
          isActive: true,
          metadata: {
            description: 'Outdoor pool bar',
            operatingHours: { start: '08:00', end: '20:00' }
          }
        },
        {
          id: 'sky_bar',
          name: 'Sky Bar',
          type: 'bar',
          bounds: [
            { x: -25, y: -15, z: 42 },
            { x: 25, y: 15, z: 45 }
          ],
          floor: 11,
          beaconUUIDs: ['sky-beacon-1'],
          uwbAnchorIds: ['uwb-sky-1'],
          priority: 1,
          capacity: 40,
          isActive: true,
          metadata: {
            description: 'Premium sky bar with panoramic views',
            operatingHours: { start: '16:00', end: '02:00' }
          }
        }
      ],
      beacons: [
        {
          uuid: 'dining-beacon-1',
          major: 1,
          minor: 1,
          position: { x: -40, y: 0, z: 11.5 },
          transmitPower: -59,
          isActive: true,
          zoneId: 'dining_main'
        },
        {
          uuid: 'bar-beacon-1',
          major: 1,
          minor: 2,
          position: { x: 0, y: 0, z: 19.5 },
          transmitPower: -59,
          isActive: true,
          zoneId: 'bar_central'
        },
        {
          uuid: 'pool-beacon-1',
          major: 1,
          minor: 3,
          position: { x: 0, y: 30, z: 27.5 },
          transmitPower: -59,
          isActive: true,
          zoneId: 'pool_bar'
        },
        {
          uuid: 'sky-beacon-1',
          major: 1,
          minor: 4,
          position: { x: 0, y: 0, z: 43.5 },
          transmitPower: -59,
          isActive: true,
          zoneId: 'sky_bar'
        }
      ],
      uwbAnchors: [
        {
          id: 'uwb-dining-1',
          position: { x: -60, y: -20, z: 11.5 },
          isActive: true,
          accuracy: 0.3,
          lastCalibrated: Date.now(),
          zoneId: 'dining_main'
        },
        {
          id: 'uwb-bar-1',
          position: { x: -15, y: -8, z: 19.5 },
          isActive: true,
          accuracy: 0.2,
          lastCalibrated: Date.now(),
          zoneId: 'bar_central'
        },
        {
          id: 'uwb-pool-1',
          position: { x: -20, y: 25, z: 27.5 },
          isActive: true,
          accuracy: 0.25,
          lastCalibrated: Date.now(),
          zoneId: 'pool_bar'
        },
        {
          id: 'uwb-sky-1',
          position: { x: -20, y: -10, z: 43.5 },
          isActive: true,
          accuracy: 0.15,
          lastCalibrated: Date.now(),
          zoneId: 'sky_bar'
        }
      ],
      referencePoint: {
        lat: 25.7617, // Miami coordinates as reference
        lng: -80.1918,
        altitude: 15 // ship deck above sea level
      },
      coordinateSystem: 'hybrid',
      lastUpdated: Date.now()
    };

    this.currentVenue = cruiseShip;
    return cruiseShip;
  }

  private async createSampleRestaurant(): Promise<Venue3DModel> {
    const restaurant: Venue3DModel = {
      id: 'restaurant_sample',
      name: 'Oceanview Restaurant',
      type: 'restaurant',
      bounds: {
        minX: 0, maxX: 50,
        minY: 0, maxY: 30,
        minZ: 0, maxZ: 6
      },
      floors: [
        { level: 0, name: 'Ground Floor', elevation: 0, zones: ['entrance', 'dining_1', 'bar_1', 'kitchen'], isAccessible: true },
        { level: 1, name: 'Upper Level', elevation: 4, zones: ['dining_2', 'bar_2'], isAccessible: true }
      ],
      zones: [
        {
          id: 'bar_1',
          name: 'Main Bar',
          type: 'bar',
          bounds: [
            { x: 5, y: 5, z: 0 },
            { x: 15, y: 15, z: 3 }
          ],
          floor: 0,
          beaconUUIDs: ['main-bar-beacon'],
          uwbAnchorIds: ['uwb-main-bar'],
          priority: 1,
          capacity: 25,
          isActive: true,
          metadata: {
            description: 'Main bar area with full service',
            staffAssigned: ['bartender-1'],
            operatingHours: { start: '11:00', end: '23:00' }
          }
        },
        {
          id: 'bar_2',
          name: 'Upper Bar',
          type: 'bar',
          bounds: [
            { x: 35, y: 10, z: 4 },
            { x: 45, y: 20, z: 7 }
          ],
          floor: 1,
          beaconUUIDs: ['upper-bar-beacon'],
          uwbAnchorIds: ['uwb-upper-bar'],
          priority: 2,
          capacity: 15,
          isActive: true,
          metadata: {
            description: 'Intimate upper level bar',
            operatingHours: { start: '17:00', end: '23:00' }
          }
        }
      ],
      beacons: [
        {
          uuid: 'main-bar-beacon',
          major: 2,
          minor: 1,
          position: { x: 10, y: 10, z: 1.5 },
          transmitPower: -59,
          isActive: true,
          zoneId: 'bar_1'
        },
        {
          uuid: 'upper-bar-beacon',
          major: 2,
          minor: 2,
          position: { x: 40, y: 15, z: 5.5 },
          transmitPower: -59,
          isActive: true,
          zoneId: 'bar_2'
        }
      ],
      uwbAnchors: [
        {
          id: 'uwb-main-bar',
          position: { x: 8, y: 12, z: 1.5 },
          isActive: true,
          accuracy: 0.2,
          lastCalibrated: Date.now(),
          zoneId: 'bar_1'
        },
        {
          id: 'uwb-upper-bar',
          position: { x: 42, y: 17, z: 5.5 },
          isActive: true,
          accuracy: 0.15,
          lastCalibrated: Date.now(),
          zoneId: 'bar_2'
        }
      ],
      referencePoint: {
        lat: 25.7617,
        lng: -80.1918,
        altitude: 5
      },
      coordinateSystem: 'hybrid',
      lastUpdated: Date.now()
    };

    this.currentVenue = restaurant;
    return restaurant;
  }

  // === ZONE MANAGEMENT ===

  addZone(zone: Zone3D): boolean {
    if (!this.currentVenue) return false;

    // Validate zone bounds
    if (!this.validateZoneBounds(zone)) {
      console.error('Invalid zone bounds');
      return false;
    }

    this.currentVenue.zones.push(zone);
    this.currentVenue.lastUpdated = Date.now();
    
    console.log(`Added zone: ${zone.name} (${zone.type})`);
    return true;
  }

  updateZone(zoneId: string, updates: Partial<Zone3D>): boolean {
    if (!this.currentVenue) return false;

    const zoneIndex = this.currentVenue.zones.findIndex(z => z.id === zoneId);
    if (zoneIndex === -1) return false;

    this.currentVenue.zones[zoneIndex] = {
      ...this.currentVenue.zones[zoneIndex],
      ...updates
    };
    this.currentVenue.lastUpdated = Date.now();

    console.log(`Updated zone: ${zoneId}`);
    return true;
  }

  removeZone(zoneId: string): boolean {
    if (!this.currentVenue) return false;

    const initialLength = this.currentVenue.zones.length;
    this.currentVenue.zones = this.currentVenue.zones.filter(z => z.id !== zoneId);
    
    if (this.currentVenue.zones.length < initialLength) {
      this.currentVenue.lastUpdated = Date.now();
      console.log(`Removed zone: ${zoneId}`);
      return true;
    }
    return false;
  }

  private validateZoneBounds(zone: Zone3D): boolean {
    if (!this.currentVenue || zone.bounds.length < 3) return false;

    // Check if zone bounds are within venue bounds
    for (const point of zone.bounds) {
      if (point.x < this.currentVenue.bounds.minX || point.x > this.currentVenue.bounds.maxX ||
          point.y < this.currentVenue.bounds.minY || point.y > this.currentVenue.bounds.maxY ||
          point.z < this.currentVenue.bounds.minZ || point.z > this.currentVenue.bounds.maxZ) {
        return false;
      }
    }
    return true;
  }

  // === DECK DETECTION (CRUISE SHIPS) ===

  async startDeckDetection(): Promise<void> {
    if (this.floorDetectionEnabled) return;

    try {
      const { status } = await Barometer.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Barometer permission denied');
        return;
      }

      this.floorDetectionEnabled = true;
      
      // Set update interval to 1 second for responsive deck detection
      Barometer.setUpdateInterval(1000);
      
      this.barometerSubscription = Barometer.addListener(({ pressure, relativeAltitude }) => {
        this.processBarometerReading(pressure, relativeAltitude ?? null);
      });

      console.log('Deck detection started');
    } catch (error) {
      console.error('Failed to start deck detection:', error);
    }
  }

  private processBarometerReading(pressure: number, relativeAltitude: number | null): void {
    if (!this.currentVenue || this.currentVenue.type !== 'cruise_ship') return;

    const currentTime = Date.now();
    
    // Use relative altitude if available, otherwise calculate from pressure
    let altitude = relativeAltitude;
    if (altitude === null) {
      // Standard atmospheric pressure formula
      altitude = 44330 * (1 - Math.pow(pressure / 1013.25, 0.1903));
    }

    // Detect deck changes (minimum 2.5m change to avoid noise)
    if (Math.abs(altitude - this.lastBarometerReading) > 2.5) {
      const detectedFloor = this.altitudeToFloor(altitude);
      
      if (this.userPosition && this.userPosition.floor !== detectedFloor) {
        console.log(`Deck change detected: ${this.userPosition.floor} → ${detectedFloor}`);
        
        this.userPosition = {
          ...this.userPosition,
          floor: detectedFloor,
          position: { ...this.userPosition.position, z: altitude },
          timestamp: currentTime,
          source: 'fused'
        };

        // Trigger zone re-detection
        this.updateUserZone();
      }
    }

    this.lastBarometerReading = altitude;
  }

  private altitudeToFloor(altitude: number): number {
    if (!this.currentVenue) return 0;

    // Find closest floor by elevation
    let closestFloor = this.currentVenue.floors[0];
    let minDifference = Math.abs(altitude - closestFloor.elevation);

    for (const floor of this.currentVenue.floors) {
      const difference = Math.abs(altitude - floor.elevation);
      if (difference < minDifference) {
        minDifference = difference;
        closestFloor = floor;
      }
    }

    return closestFloor.level;
  }

  stopDeckDetection(): void {
    if (this.barometerSubscription) {
      this.barometerSubscription.remove();
      this.barometerSubscription = null;
    }
    this.floorDetectionEnabled = false;
    console.log('Deck detection stopped');
  }

  // === POSITION TRACKING ===

  updateUserPosition(position: Partial<UserPosition3D>): void {
    const currentTime = Date.now();
    
    this.userPosition = {
      position: position.position || { x: 0, y: 0, z: 0 },
      floor: position.floor || 0,
      zoneId: position.zoneId,
      accuracy: position.accuracy || 10,
      timestamp: currentTime,
      source: position.source || 'gps',
      confidence: position.confidence || 0.5,
      nearestBeacons: position.nearestBeacons || [],
      nearestUWBAnchors: position.nearestUWBAnchors || []
    };

    // Apply map matching if enabled
    if (this.mapMatchingEnabled) {
      this.applyMapMatching();
    }

    // Update zone detection
    this.updateUserZone();
  }

  private applyMapMatching(): void {
    if (!this.userPosition || !this.currentVenue) return;

    // Snap to nearest valid zone if within reasonable distance
    const nearbyZones = this.getZonesNearPosition(this.userPosition.position, 5.0);
    
    if (nearbyZones.length > 0) {
      const closestZone = nearbyZones[0];
      
      // Snap to zone center if very close
      if (this.distanceToZone(this.userPosition.position, closestZone) < 2.0) {
        const zoneCenter = this.getZoneCenter(closestZone);
        this.userPosition.position = {
          x: zoneCenter.x,
          y: zoneCenter.y,
          z: this.userPosition.position.z // Keep original Z
        };
        this.userPosition.zoneId = closestZone.id;
        this.userPosition.confidence = Math.min(1.0, this.userPosition.confidence + 0.2);
      }
    }
  }

  private updateUserZone(): void {
    if (!this.userPosition || !this.currentVenue) return;

    const currentZone = this.getZoneAtPosition(this.userPosition.position);
    if (currentZone && currentZone.id !== this.userPosition.zoneId) {
      this.userPosition.zoneId = currentZone.id;
      console.log(`User entered zone: ${currentZone.name}`);
    }
  }

  // === UTILITY METHODS ===

  getZoneAtPosition(position: Point3D): Zone3D | null {
    if (!this.currentVenue) return null;

    for (const zone of this.currentVenue.zones) {
      if (this.isPointInZone(position, zone)) {
        return zone;
      }
    }
    return null;
  }

  private isPointInZone(point: Point3D, zone: Zone3D): boolean {
    // Simple bounding box check for now
    // In a real implementation, use proper polygon containment
    if (zone.bounds.length < 2) return false;

    const minX = Math.min(...zone.bounds.map(p => p.x));
    const maxX = Math.max(...zone.bounds.map(p => p.x));
    const minY = Math.min(...zone.bounds.map(p => p.y));
    const maxY = Math.max(...zone.bounds.map(p => p.y));
    const minZ = Math.min(...zone.bounds.map(p => p.z));
    const maxZ = Math.max(...zone.bounds.map(p => p.z));

    return point.x >= minX && point.x <= maxX &&
           point.y >= minY && point.y <= maxY &&
           point.z >= minZ && point.z <= maxZ;
  }

  getZonesNearPosition(position: Point3D, radius: number): Zone3D[] {
    if (!this.currentVenue) return [];

    return this.currentVenue.zones
      .map(zone => ({
        zone,
        distance: this.distanceToZone(position, zone)
      }))
      .filter(({ distance }) => distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .map(({ zone }) => zone);
  }

  private distanceToZone(position: Point3D, zone: Zone3D): number {
    const zoneCenter = this.getZoneCenter(zone);
    return Math.sqrt(
      Math.pow(position.x - zoneCenter.x, 2) +
      Math.pow(position.y - zoneCenter.y, 2) +
      Math.pow(position.z - zoneCenter.z, 2)
    );
  }

  private getZoneCenter(zone: Zone3D): Point3D {
    const avgX = zone.bounds.reduce((sum, p) => sum + p.x, 0) / zone.bounds.length;
    const avgY = zone.bounds.reduce((sum, p) => sum + p.y, 0) / zone.bounds.length;
    const avgZ = zone.bounds.reduce((sum, p) => sum + p.z, 0) / zone.bounds.length;
    
    return { x: avgX, y: avgY, z: avgZ };
  }

  // === DELIVERY ROUTING ===

  findNearestBar(userPosition: Point3D): Zone3D | null {
    if (!this.currentVenue) return null;

    const bars = this.currentVenue.zones
      .filter(zone => zone.type === 'bar' && zone.isActive)
      .map(bar => ({
        bar,
        distance: this.distanceToZone(userPosition, bar)
      }))
      .sort((a, b) => {
        // Sort by priority first, then distance
        if (a.bar.priority !== b.bar.priority) {
          return a.bar.priority - b.bar.priority;
        }
        return a.distance - b.distance;
      });

    return bars.length > 0 ? bars[0].bar : null;
  }

  calculateDeliveryRoute(fromZoneId: string, toZoneId: string): DeliveryRoute3D | null {
    if (!this.currentVenue) return null;

    const fromZone = this.currentVenue.zones.find(z => z.id === fromZoneId);
    const toZone = this.currentVenue.zones.find(z => z.id === toZoneId);

    if (!fromZone || !toZone) return null;

    const fromCenter = this.getZoneCenter(fromZone);
    const toCenter = this.getZoneCenter(toZone);

    // Simple direct route for now
    // In a real implementation, use pathfinding algorithms
    const route: DeliveryRoute3D = {
      fromZone: fromZoneId,
      toZone: toZoneId,
      waypoints: [fromCenter, toCenter],
      estimatedTime: this.estimateDeliveryTime(fromCenter, toCenter),
      difficulty: this.assessRouteDifficulty(fromZone, toZone),
      instructions: this.generateRouteInstructions(fromZone, toZone)
    };

    return route;
  }

  private estimateDeliveryTime(from: Point3D, to: Point3D): number {
    const distance = Math.sqrt(
      Math.pow(to.x - from.x, 2) +
      Math.pow(to.y - from.y, 2) +
      Math.pow(to.z - from.z, 2)
    );

    // Assume 1.5 m/s walking speed + 30s per floor change
    const floorChanges = Math.abs(to.z - from.z) / 3.5; // 3.5m per floor
    return Math.round(distance / 1.5 + floorChanges * 30);
  }

  private assessRouteDifficulty(fromZone: Zone3D, toZone: Zone3D): 'easy' | 'medium' | 'hard' {
    const floorDifference = Math.abs(fromZone.floor - toZone.floor);
    
    if (floorDifference === 0) return 'easy';
    if (floorDifference <= 2) return 'medium';
    return 'hard';
  }

  private generateRouteInstructions(fromZone: Zone3D, toZone: Zone3D): string[] {
    const instructions: string[] = [];
    
    instructions.push(`Start from ${fromZone.name}`);
    
    if (fromZone.floor !== toZone.floor) {
      const direction = toZone.floor > fromZone.floor ? 'up' : 'down';
      const floors = Math.abs(toZone.floor - fromZone.floor);
      instructions.push(`Go ${direction} ${floors} floor${floors > 1 ? 's' : ''}`);
    }
    
    instructions.push(`Proceed to ${toZone.name}`);
    
    return instructions;
  }

  // === GETTERS ===

  getCurrentVenue(): Venue3DModel | null {
    return this.currentVenue;
  }

  getUserPosition(): UserPosition3D | null {
    return this.userPosition;
  }

  getActiveZones(): Zone3D[] {
    return this.currentVenue?.zones.filter(zone => zone.isActive) || [];
  }

  getBarsInVenue(): Zone3D[] {
    return this.currentVenue?.zones.filter(zone => zone.type === 'bar' && zone.isActive) || [];
  }

  getBeaconByUUID(uuid: string): BeaconAnchor | null {
    return this.currentVenue?.beacons.find(beacon => beacon.uuid === uuid) || null;
  }

  getUWBAnchorById(id: string): UWBAnchor | null {
    return this.currentVenue?.uwbAnchors.find(anchor => anchor.id === id) || null;
  }
}

export default Venue3DMapService;
