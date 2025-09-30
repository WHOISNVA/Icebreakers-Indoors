import { Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';

// 3D Coordinate System Types
export interface Point3D {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface GeoPoint3D {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface VenueModel {
  id: string;
  name: string;
  bounds: GeoBounds;
  floors: FloorModel[];
  referencePoints: ReferencePoint[];
  coordinateSystem: CoordinateSystem;
}

export interface FloorModel {
  level: number;
  name: string;
  elevation: number; // meters above sea level
  bounds: GeoBounds;
  zones: Zone[];
  obstacles: Obstacle[];
}

export interface Zone {
  id: string;
  name: string;
  type: 'bar' | 'seating' | 'walkway' | 'restricted' | 'bathroom' | 'kitchen';
  polygon: Point3D[];
  properties: Record<string, any>;
}

export interface Obstacle {
  id: string;
  type: 'wall' | 'furniture' | 'equipment';
  polygon: Point3D[];
  height: number;
}

export interface ReferencePoint {
  id: string;
  geoLocation: GeoPoint3D;
  localCoordinate: Point3D;
  type: 'gps_anchor' | 'visual_marker' | 'beacon' | 'uwb_anchor';
  confidence: number;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  maxAltitude?: number;
  minAltitude?: number;
}

export interface CoordinateSystem {
  origin: GeoPoint3D;
  rotation: number; // degrees from north
  scale: number; // meters per unit
}

export interface SpatialPosition {
  global: GeoPoint3D;
  local: Point3D;
  floor: number;
  zone?: Zone;
  confidence: number;
  sources: PositionSource[];
}

export interface PositionSource {
  type: 'gnss' | 'vio' | 'beacon' | 'uwb' | 'visual' | 'dead_reckoning';
  weight: number;
  accuracy: number;
  timestamp: number;
}

// Configuration for the spatial service
export interface Spatial3DConfig {
  onPositionUpdate?: (position: SpatialPosition) => void;
  onFloorChange?: (newFloor: number, oldFloor: number) => void;
  onZoneEnter?: (zone: Zone) => void;
  onZoneExit?: (zone: Zone) => void;
  enableHighAccuracyMode?: boolean;
  enable3DTracking?: boolean;
  floorDetectionThreshold?: number; // meters
}

class Spatial3DService {
  private config: Spatial3DConfig;
  private venueModel: VenueModel | null = null;
  private currentPosition: SpatialPosition | null = null;
  private currentFloor: number = 0;
  private currentZone: Zone | null = null;
  private isActive: boolean = false;

  // Coordinate transformation matrices
  private transformationMatrix: number[][] = [];
  private inverseTransformationMatrix: number[][] = [];

  // Position fusion system
  private positionSources: Map<string, PositionSource> = new Map();
  private positionHistory: SpatialPosition[] = [];

  constructor(config: Spatial3DConfig = {}) {
    this.config = {
      enableHighAccuracyMode: true,
      enable3DTracking: true,
      floorDetectionThreshold: 3.0, // 3 meters
      ...config
    };
  }

  async loadVenueModel(venueId: string): Promise<void> {
    try {
      // In a real implementation, this would load from a server or local storage
      // For now, we'll create a sample venue model
      this.venueModel = await this.createSampleVenueModel(venueId);
      this.setupCoordinateTransformation();
      console.log(`Loaded venue model: ${this.venueModel.name}`);
    } catch (error) {
      console.error('Error loading venue model:', error);
      throw error;
    }
  }

  private async createSampleVenueModel(venueId: string): Promise<VenueModel> {
    // Sample delivery venue model (adaptable for bars, restaurants, cruise ships, etc.)
    return {
      id: venueId,
      name: 'Sample Delivery Venue - Main Floor',
      bounds: {
        north: 25.7617,
        south: 25.7607,
        east: -80.1918,
        west: -80.1928,
        maxAltitude: 30,
        minAltitude: 20
      },
      coordinateSystem: {
        origin: {
          latitude: 25.7612,
          longitude: -80.1923,
          altitude: 25,
          timestamp: Date.now()
        },
        rotation: 0,
        scale: 1.0
      },
      referencePoints: [
        {
          id: 'bow_anchor',
          geoLocation: { latitude: 25.7617, longitude: -80.1923, altitude: 25, timestamp: Date.now() },
          localCoordinate: { x: 0, y: 100, z: 0, timestamp: Date.now() },
          type: 'gps_anchor',
          confidence: 0.9
        },
        {
          id: 'stern_anchor',
          geoLocation: { latitude: 25.7607, longitude: -80.1923, altitude: 25, timestamp: Date.now() },
          localCoordinate: { x: 0, y: -100, z: 0, timestamp: Date.now() },
          type: 'gps_anchor',
          confidence: 0.9
        }
      ],
      floors: [
        {
          level: 1,
          name: 'Main Floor',
          elevation: 0,
          bounds: {
            north: 25.7617,
            south: 25.7607,
            east: -80.1918,
            west: -80.1928
          },
          zones: [
            {
              id: 'main_bar',
              name: 'Main Bar',
              type: 'bar',
              polygon: [
                { x: -20, y: 0, z: 0, timestamp: Date.now() },
                { x: 20, y: 0, z: 0, timestamp: Date.now() },
                { x: 20, y: 10, z: 0, timestamp: Date.now() },
                { x: -20, y: 10, z: 0, timestamp: Date.now() }
              ],
              properties: { capacity: 50, staff_count: 3 }
            },
            {
              id: 'seating_area',
              name: 'Seating Area',
              type: 'seating',
              polygon: [
                { x: -30, y: -50, z: 0, timestamp: Date.now() },
                { x: 30, y: -50, z: 0, timestamp: Date.now() },
                { x: 30, y: -10, z: 0, timestamp: Date.now() },
                { x: -30, y: -10, z: 0, timestamp: Date.now() }
              ],
              properties: { table_count: 20 }
            }
          ],
          obstacles: [
            {
              id: 'central_pillar',
              type: 'equipment',
              polygon: [
                { x: -2, y: -2, z: 0, timestamp: Date.now() },
                { x: 2, y: -2, z: 0, timestamp: Date.now() },
                { x: 2, y: 2, z: 0, timestamp: Date.now() },
                { x: -2, y: 2, z: 0, timestamp: Date.now() }
              ],
              height: 3.0
            }
          ]
        }
      ]
    };
  }

  private setupCoordinateTransformation(): void {
    if (!this.venueModel) return;

    const origin = this.venueModel.coordinateSystem.origin;
    const rotation = this.venueModel.coordinateSystem.rotation * Math.PI / 180;
    const scale = this.venueModel.coordinateSystem.scale;

    // Create transformation matrix for geo to local coordinates
    this.transformationMatrix = [
      [Math.cos(rotation) * scale, -Math.sin(rotation) * scale, 0],
      [Math.sin(rotation) * scale, Math.cos(rotation) * scale, 0],
      [0, 0, scale]
    ];

    // Create inverse transformation matrix
    const invScale = 1 / scale;
    this.inverseTransformationMatrix = [
      [Math.cos(-rotation) * invScale, -Math.sin(-rotation) * invScale, 0],
      [Math.sin(-rotation) * invScale, Math.cos(-rotation) * invScale, 0],
      [0, 0, invScale]
    ];
  }

  convertGeoToLocal(geoPoint: GeoPoint3D): Point3D {
    if (!this.venueModel) {
      throw new Error('Venue model not loaded');
    }

    const origin = this.venueModel.coordinateSystem.origin;
    
    // Convert lat/lon to meters from origin
    const deltaLat = geoPoint.latitude - origin.latitude;
    const deltaLon = geoPoint.longitude - origin.longitude;
    const deltaAlt = geoPoint.altitude - origin.altitude;

    // Rough conversion: 1 degree ≈ 111,320 meters
    const x = deltaLon * 111320 * Math.cos(origin.latitude * Math.PI / 180);
    const y = deltaLat * 111320;
    const z = deltaAlt;

    // Apply transformation matrix
    const transformed = this.applyTransformation([x, y, z], this.transformationMatrix);

    return {
      x: transformed[0],
      y: transformed[1],
      z: transformed[2],
      timestamp: geoPoint.timestamp
    };
  }

  convertLocalToGeo(localPoint: Point3D): GeoPoint3D {
    if (!this.venueModel) {
      throw new Error('Venue model not loaded');
    }

    // Apply inverse transformation
    const transformed = this.applyTransformation(
      [localPoint.x, localPoint.y, localPoint.z],
      this.inverseTransformationMatrix
    );

    const origin = this.venueModel.coordinateSystem.origin;
    
    // Convert meters back to lat/lon
    const deltaLat = transformed[1] / 111320;
    const deltaLon = transformed[0] / (111320 * Math.cos(origin.latitude * Math.PI / 180));
    const deltaAlt = transformed[2];

    return {
      latitude: origin.latitude + deltaLat,
      longitude: origin.longitude + deltaLon,
      altitude: origin.altitude + deltaAlt,
      timestamp: localPoint.timestamp
    };
  }

  private applyTransformation(point: number[], matrix: number[][]): number[] {
    return [
      matrix[0][0] * point[0] + matrix[0][1] * point[1] + matrix[0][2] * point[2],
      matrix[1][0] * point[0] + matrix[1][1] * point[1] + matrix[1][2] * point[2],
      matrix[2][0] * point[0] + matrix[2][1] * point[1] + matrix[2][2] * point[2]
    ];
  }

  updatePosition(geoPosition: GeoPoint3D, sources: PositionSource[]): void {
    if (!this.venueModel) {
      console.warn('Cannot update position: venue model not loaded');
      return;
    }

    // Convert to local coordinates
    const localPosition = this.convertGeoToLocal(geoPosition);

    // Determine floor
    const floor = this.determineFloor(geoPosition.altitude);

    // Find current zone
    const zone = this.findZone(localPosition, floor);

    // Calculate confidence based on sources
    const confidence = this.calculatePositionConfidence(sources);

    // Create spatial position
    const spatialPosition: SpatialPosition = {
      global: geoPosition,
      local: localPosition,
      floor,
      zone: zone || undefined,
      confidence,
      sources
    };

    // Check for floor changes
    if (floor !== this.currentFloor) {
      this.config.onFloorChange?.(floor, this.currentFloor);
      this.currentFloor = floor;
    }

    // Check for zone changes
    if (zone !== this.currentZone) {
      if (this.currentZone) {
        this.config.onZoneExit?.(this.currentZone);
      }
      if (zone) {
        this.config.onZoneEnter?.(zone);
      }
      this.currentZone = zone;
    }

    // Store position
    this.currentPosition = spatialPosition;
    this.positionHistory.push(spatialPosition);
    if (this.positionHistory.length > 100) {
      this.positionHistory.shift();
    }

    // Notify subscribers
    this.config.onPositionUpdate?.(spatialPosition);
  }

  private determineFloor(altitude: number): number {
    if (!this.venueModel) return 0;

    let closestFloor = this.venueModel.floors[0];
    let minDistance = Math.abs(altitude - closestFloor.elevation);

    for (const floor of this.venueModel.floors) {
      const distance = Math.abs(altitude - floor.elevation);
      if (distance < minDistance) {
        minDistance = distance;
        closestFloor = floor;
      }
    }

    return closestFloor.level;
  }

  private findZone(localPosition: Point3D, floor: number): Zone | null {
    if (!this.venueModel) return null;

    const floorModel = this.venueModel.floors.find(f => f.level === floor);
    if (!floorModel) return null;

    for (const zone of floorModel.zones) {
      if (this.isPointInPolygon(localPosition, zone.polygon)) {
        return zone;
      }
    }

    return null;
  }

  private isPointInPolygon(point: Point3D, polygon: Point3D[]): boolean {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  private calculatePositionConfidence(sources: PositionSource[]): number {
    if (sources.length === 0) return 0;

    let totalWeight = 0;
    let weightedConfidence = 0;

    for (const source of sources) {
      const sourceConfidence = Math.max(0, 1 - (source.accuracy || 0) / 10);
      weightedConfidence += sourceConfidence * source.weight;
      totalWeight += source.weight;
    }

    return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
  }

  // Get proximity to bars for delivery optimization
  getNearbyBars(radius: number = 50): Array<{zone: Zone, distance: number}> {
    if (!this.currentPosition || !this.venueModel) return [];

    const currentFloor = this.venueModel.floors.find(f => f.level === this.currentPosition!.floor);
    if (!currentFloor) return [];

    const bars = currentFloor.zones.filter(zone => zone.type === 'bar');
    const nearbyBars: Array<{zone: Zone, distance: number}> = [];

    for (const bar of bars) {
      // Calculate distance to center of bar zone
      const barCenter = this.calculatePolygonCenter(bar.polygon);
      const distance = this.calculateDistance3D(this.currentPosition.local, barCenter);
      
      if (distance <= radius) {
        nearbyBars.push({ zone: bar, distance });
      }
    }

    // Sort by distance
    return nearbyBars.sort((a, b) => a.distance - b.distance);
  }

  private calculatePolygonCenter(polygon: Point3D[]): Point3D {
    const center = polygon.reduce(
      (acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y,
        z: acc.z + point.z,
        timestamp: Date.now()
      }),
      { x: 0, y: 0, z: 0, timestamp: Date.now() }
    );

    return {
      x: center.x / polygon.length,
      y: center.y / polygon.length,
      z: center.z / polygon.length,
      timestamp: Date.now()
    };
  }

  private calculateDistance3D(point1: Point3D, point2: Point3D): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getCurrentPosition(): SpatialPosition | null {
    return this.currentPosition;
  }

  getVenueModel(): VenueModel | null {
    return this.venueModel;
  }

  getPositionHistory(): SpatialPosition[] {
    return [...this.positionHistory];
  }

  // AR/VR coordinate system helpers
  getARTransformMatrix(): number[][] {
    return this.transformationMatrix;
  }

  getLocalBounds(): { min: Point3D, max: Point3D } | null {
    if (!this.venueModel) return null;

    const bounds = this.venueModel.bounds;
    const min = this.convertGeoToLocal({
      latitude: bounds.south,
      longitude: bounds.west,
      altitude: bounds.minAltitude || 0,
      timestamp: Date.now()
    });

    const max = this.convertGeoToLocal({
      latitude: bounds.north,
      longitude: bounds.east,
      altitude: bounds.maxAltitude || 100,
      timestamp: Date.now()
    });

    return { min, max };
  }
}

export default Spatial3DService;
