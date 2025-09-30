import { Point3D, Zone3D, Venue3DModel } from './Venue3DMapService';
import { FusedPosition } from './EnhancedARVIOService';

// Advanced Map-Matching Service for Indoor Navigation
export interface NavigationPath {
  pathId: string;
  startZone: string;
  endZone: string;
  waypoints: Point3D[];
  segments: PathSegment[];
  totalDistance: number;
  estimatedTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  accessibility: boolean;
  lastUpdated: number;
}

export interface PathSegment {
  segmentId: string;
  startPoint: Point3D;
  endPoint: Point3D;
  type: 'corridor' | 'stairs' | 'elevator' | 'door' | 'open_area' | 'restricted';
  width: number; // meters
  length: number;
  floor: number;
  direction: number; // degrees from north
  constraints: {
    maxSpeed: number; // m/s
    minClearance: number; // meters
    requiresAccess: boolean;
    timeRestrictions?: { start: string; end: string };
  };
  landmarks: Landmark[];
}

export interface Landmark {
  landmarkId: string;
  position: Point3D;
  type: 'beacon' | 'door' | 'pillar' | 'artwork' | 'sign' | 'furniture' | 'bar' | 'restroom';
  name: string;
  description?: string;
  isVisible: boolean;
  confidence: number; // 0-1
}

export interface MatchedPosition {
  originalPosition: Point3D;
  matchedPosition: Point3D;
  pathId?: string;
  segmentId?: string;
  zoneId?: string;
  confidence: number;
  distanceToPath: number;
  heading: number; // degrees
  speed: number; // m/s
  timestamp: number;
  matchingMethod: 'geometric' | 'topological' | 'probabilistic' | 'hybrid';
}

export interface NavigationState {
  currentPosition: MatchedPosition;
  targetZone?: string;
  activePath?: NavigationPath;
  progress: number; // 0-1
  nextWaypoint?: Point3D;
  nextLandmark?: Landmark;
  estimatedTimeToDestination: number;
  deviationFromPath: number;
  isOnPath: boolean;
  navigationQuality: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface MapMatchingConfig {
  searchRadius: number; // meters
  snapThreshold: number; // meters
  headingWeight: number; // 0-1
  speedWeight: number; // 0-1
  continuityWeight: number; // 0-1
  enablePrediction: boolean;
  predictionHorizon: number; // seconds
  pathSmoothingFactor: number; // 0-1
}

class MapMatchingService {
  private static instance: MapMatchingService;
  private venue: Venue3DModel | null = null;
  private navigationPaths: Map<string, NavigationPath> = new Map();
  private landmarks: Map<string, Landmark> = new Map();
  private currentState: NavigationState | null = null;
  private positionHistory: MatchedPosition[] = [];
  private config: MapMatchingConfig;
  
  // Callbacks
  private positionCallback: ((position: MatchedPosition) => void) | null = null;
  private navigationCallback: ((state: NavigationState) => void) | null = null;
  private pathDeviationCallback: ((deviation: number) => void) | null = null;

  static getInstance(): MapMatchingService {
    if (!MapMatchingService.instance) {
      MapMatchingService.instance = new MapMatchingService();
    }
    return MapMatchingService.instance;
  }

  constructor() {
    this.config = {
      searchRadius: 10.0,      // 10 meters
      snapThreshold: 2.0,      // 2 meters
      headingWeight: 0.3,
      speedWeight: 0.2,
      continuityWeight: 0.5,
      enablePrediction: true,
      predictionHorizon: 3.0,  // 3 seconds
      pathSmoothingFactor: 0.7
    };
  }

  // === INITIALIZATION ===

  initialize(venue: Venue3DModel): void {
    this.venue = venue;
    this.generateNavigationPaths();
    this.extractLandmarks();
    console.log(`Map matching initialized for venue: ${venue.name}`);
  }

  private generateNavigationPaths(): void {
    if (!this.venue) return;

    this.navigationPaths.clear();
    
    // Generate paths between all zone pairs
    const zones = this.venue.zones.filter(zone => zone.isActive);
    
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const path = this.calculatePath(zones[i], zones[j]);
        if (path) {
          this.navigationPaths.set(path.pathId, path);
        }
      }
    }

    console.log(`Generated ${this.navigationPaths.size} navigation paths`);
  }

  private calculatePath(startZone: Zone3D, endZone: Zone3D): NavigationPath | null {
    // Simplified path calculation - in practice, use A* or Dijkstra's algorithm
    const startCenter = this.getZoneCenter(startZone);
    const endCenter = this.getZoneCenter(endZone);
    
    const pathId = `path_${startZone.id}_to_${endZone.id}`;
    const distance = this.calculateDistance(startCenter, endCenter);
    const floorDifference = Math.abs(startZone.floor - endZone.floor);
    
    // Create simple direct path with floor transitions
    const waypoints: Point3D[] = [startCenter];
    const segments: PathSegment[] = [];
    
    // Add floor transition if needed
    if (floorDifference > 0) {
      const transitionPoint = {
        x: (startCenter.x + endCenter.x) / 2,
        y: (startCenter.y + endCenter.y) / 2,
        z: startCenter.z
      };
      waypoints.push(transitionPoint);
      
      // Add stairs/elevator segment
      segments.push({
        segmentId: `${pathId}_transition`,
        startPoint: transitionPoint,
        endPoint: { ...transitionPoint, z: endCenter.z },
        type: floorDifference > 2 ? 'elevator' : 'stairs',
        width: 2.0,
        length: Math.abs(endCenter.z - startCenter.z),
        floor: Math.min(startZone.floor, endZone.floor),
        direction: 0,
        constraints: {
          maxSpeed: 0.5, // Slower on stairs/elevator
          minClearance: 1.0,
          requiresAccess: false
        },
        landmarks: []
      });
      
      waypoints.push({ ...transitionPoint, z: endCenter.z });
    }
    
    waypoints.push(endCenter);
    
    // Add main corridor segment
    segments.push({
      segmentId: `${pathId}_main`,
      startPoint: waypoints[waypoints.length - 2],
      endPoint: endCenter,
      type: 'corridor',
      width: 3.0,
      length: this.calculateDistance(waypoints[waypoints.length - 2], endCenter),
      floor: endZone.floor,
      direction: this.calculateBearing(waypoints[waypoints.length - 2], endCenter),
      constraints: {
        maxSpeed: 1.5,
        minClearance: 0.8,
        requiresAccess: false
      },
      landmarks: []
    });

    return {
      pathId,
      startZone: startZone.id,
      endZone: endZone.id,
      waypoints,
      segments,
      totalDistance: distance,
      estimatedTime: this.estimatePathTime(distance, floorDifference),
      difficulty: this.assessPathDifficulty(distance, floorDifference),
      accessibility: floorDifference === 0 || segments.some(s => s.type === 'elevator'),
      lastUpdated: Date.now()
    };
  }

  private extractLandmarks(): void {
    if (!this.venue) return;

    this.landmarks.clear();
    let landmarkCounter = 1;

    // Extract landmarks from beacons
    this.venue.beacons.forEach(beacon => {
      if (beacon.isActive) {
        const landmark: Landmark = {
          landmarkId: `landmark_beacon_${landmarkCounter++}`,
          position: beacon.position,
          type: 'beacon',
          name: `Beacon ${beacon.uuid}`,
          isVisible: false, // Beacons are not visually visible
          confidence: 0.9
        };
        this.landmarks.set(landmark.landmarkId, landmark);
      }
    });

    // Extract landmarks from zones (bars, restrooms, etc.)
    this.venue.zones.forEach(zone => {
      if (zone.isActive) {
        const zoneCenter = this.getZoneCenter(zone);
        const landmark: Landmark = {
          landmarkId: `landmark_zone_${zone.id}`,
          position: zoneCenter,
          type: zone.type as any,
          name: zone.name,
          description: zone.metadata.description,
          isVisible: true,
          confidence: 0.8
        };
        this.landmarks.set(landmark.landmarkId, landmark);
      }
    });

    console.log(`Extracted ${this.landmarks.size} landmarks`);
  }

  // === MAP MATCHING ===

  matchPosition(fusedPosition: FusedPosition): MatchedPosition {
    const rawPosition = fusedPosition.position;
    
    // Find candidate paths within search radius
    const candidatePaths = this.findCandidatePaths(rawPosition);
    
    let bestMatch: MatchedPosition;
    
    if (candidatePaths.length === 0) {
      // No paths nearby - use zone-based matching
      bestMatch = this.matchToZone(rawPosition, fusedPosition);
    } else {
      // Match to best path
      bestMatch = this.matchToPath(rawPosition, candidatePaths, fusedPosition);
    }

    // Apply smoothing based on position history
    if (this.positionHistory.length > 0) {
      bestMatch = this.applySmoothingFilter(bestMatch);
    }

    // Store in history
    this.positionHistory.push(bestMatch);
    if (this.positionHistory.length > 50) {
      this.positionHistory.shift();
    }

    // Update navigation state
    this.updateNavigationState(bestMatch);

    // Trigger callbacks
    if (this.positionCallback) {
      this.positionCallback(bestMatch);
    }

    return bestMatch;
  }

  private findCandidatePaths(position: Point3D): NavigationPath[] {
    const candidates: NavigationPath[] = [];
    
    for (const path of this.navigationPaths.values()) {
      // Check if position is within search radius of any path segment
      for (const segment of path.segments) {
        const distanceToSegment = this.distanceToLineSegment(
          position,
          segment.startPoint,
          segment.endPoint
        );
        
        if (distanceToSegment <= this.config.searchRadius) {
          candidates.push(path);
          break;
        }
      }
    }
    
    return candidates;
  }

  private matchToPath(
    position: Point3D,
    candidatePaths: NavigationPath[],
    fusedPosition: FusedPosition
  ): MatchedPosition {
    let bestMatch: MatchedPosition | null = null;
    let bestScore = -Infinity;

    for (const path of candidatePaths) {
      for (const segment of path.segments) {
        const projectedPoint = this.projectPointToSegment(
          position,
          segment.startPoint,
          segment.endPoint
        );
        
        const distance = this.calculateDistance(position, projectedPoint);
        
        if (distance <= this.config.snapThreshold) {
          const score = this.calculateMatchingScore(
            position,
            projectedPoint,
            segment,
            fusedPosition
          );
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              originalPosition: position,
              matchedPosition: projectedPoint,
              pathId: path.pathId,
              segmentId: segment.segmentId,
              confidence: Math.min(1.0, score / 100),
              distanceToPath: distance,
              heading: segment.direction,
              speed: this.estimateSpeed(),
              timestamp: Date.now(),
              matchingMethod: 'geometric'
            };
          }
        }
      }
    }

    return bestMatch || this.matchToZone(position, fusedPosition);
  }

  private matchToZone(position: Point3D, fusedPosition: FusedPosition): MatchedPosition {
    if (!this.venue) {
      return {
        originalPosition: position,
        matchedPosition: position,
        confidence: 0.5,
        distanceToPath: 0,
        heading: 0,
        speed: 0,
        timestamp: Date.now(),
        matchingMethod: 'geometric'
      };
    }

    // Find closest zone
    let closestZone: Zone3D | null = null;
    let minDistance = Infinity;

    for (const zone of this.venue.zones) {
      if (zone.isActive) {
        const zoneCenter = this.getZoneCenter(zone);
        const distance = this.calculateDistance(position, zoneCenter);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestZone = zone;
        }
      }
    }

    const matchedPosition = closestZone ? this.getZoneCenter(closestZone) : position;

    return {
      originalPosition: position,
      matchedPosition,
      zoneId: closestZone?.id,
      confidence: closestZone ? Math.max(0.3, 1.0 - minDistance / 10) : 0.3,
      distanceToPath: minDistance,
      heading: fusedPosition.orientation?.yaw || 0,
      speed: this.estimateSpeed(),
      timestamp: Date.now(),
      matchingMethod: 'topological'
    };
  }

  private calculateMatchingScore(
    originalPos: Point3D,
    projectedPos: Point3D,
    segment: PathSegment,
    fusedPosition: FusedPosition
  ): number {
    let score = 0;

    // Distance score (closer is better)
    const distance = this.calculateDistance(originalPos, projectedPos);
    score += (this.config.snapThreshold - distance) * 20;

    // Heading score (aligned with segment direction)
    if (fusedPosition.orientation) {
      const headingDiff = Math.abs(fusedPosition.orientation.yaw - segment.direction);
      const normalizedHeadingDiff = Math.min(headingDiff, 360 - headingDiff);
      score += (180 - normalizedHeadingDiff) / 180 * 30 * this.config.headingWeight;
    }

    // Speed score (reasonable speed for segment type)
    const estimatedSpeed = this.estimateSpeed();
    if (estimatedSpeed <= segment.constraints.maxSpeed) {
      score += 20 * this.config.speedWeight;
    }

    // Continuity score (consistent with previous positions)
    if (this.positionHistory.length > 0) {
      const lastPosition = this.positionHistory[this.positionHistory.length - 1];
      if (lastPosition.pathId === segment.segmentId || lastPosition.segmentId === segment.segmentId) {
        score += 30 * this.config.continuityWeight;
      }
    }

    return score;
  }

  private applySmoothingFilter(position: MatchedPosition): MatchedPosition {
    if (this.positionHistory.length === 0) return position;

    const lastPosition = this.positionHistory[this.positionHistory.length - 1];
    const alpha = this.config.pathSmoothingFactor;

    // Smooth position
    const smoothedPosition: Point3D = {
      x: lastPosition.matchedPosition.x * (1 - alpha) + position.matchedPosition.x * alpha,
      y: lastPosition.matchedPosition.y * (1 - alpha) + position.matchedPosition.y * alpha,
      z: lastPosition.matchedPosition.z * (1 - alpha) + position.matchedPosition.z * alpha
    };

    // Smooth heading
    const smoothedHeading = this.smoothAngle(lastPosition.heading, position.heading, alpha);

    return {
      ...position,
      matchedPosition: smoothedPosition,
      heading: smoothedHeading
    };
  }

  private smoothAngle(lastAngle: number, newAngle: number, alpha: number): number {
    // Handle angle wrapping
    let diff = newAngle - lastAngle;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    return (lastAngle + diff * alpha + 360) % 360;
  }

  // === NAVIGATION STATE MANAGEMENT ===

  private updateNavigationState(position: MatchedPosition): void {
    if (!this.currentState) {
      this.currentState = {
        currentPosition: position,
        progress: 0,
        estimatedTimeToDestination: 0,
        deviationFromPath: position.distanceToPath,
        isOnPath: position.distanceToPath <= this.config.snapThreshold,
        navigationQuality: this.assessNavigationQuality(position)
      };
    } else {
      this.currentState.currentPosition = position;
      this.currentState.deviationFromPath = position.distanceToPath;
      this.currentState.isOnPath = position.distanceToPath <= this.config.snapThreshold;
      this.currentState.navigationQuality = this.assessNavigationQuality(position);

      // Update progress if on active path
      if (this.currentState.activePath && position.pathId === this.currentState.activePath.pathId) {
        this.currentState.progress = this.calculatePathProgress(position, this.currentState.activePath);
        this.currentState.estimatedTimeToDestination = this.estimateTimeToDestination(
          position,
          this.currentState.activePath
        );
        this.currentState.nextWaypoint = this.getNextWaypoint(position, this.currentState.activePath);
        this.currentState.nextLandmark = this.getNextLandmark(position);
      }
    }

    // Check for path deviation
    if (this.currentState.deviationFromPath > this.config.snapThreshold * 2) {
      if (this.pathDeviationCallback) {
        this.pathDeviationCallback(this.currentState.deviationFromPath);
      }
    }

    // Trigger navigation callback
    if (this.navigationCallback) {
      this.navigationCallback(this.currentState);
    }
  }

  private assessNavigationQuality(position: MatchedPosition): 'poor' | 'fair' | 'good' | 'excellent' {
    if (position.confidence > 0.8 && position.distanceToPath < 1.0) return 'excellent';
    if (position.confidence > 0.6 && position.distanceToPath < 2.0) return 'good';
    if (position.confidence > 0.4 && position.distanceToPath < 4.0) return 'fair';
    return 'poor';
  }

  private calculatePathProgress(position: MatchedPosition, path: NavigationPath): number {
    if (!position.segmentId) return 0;

    let totalDistance = 0;
    let progressDistance = 0;
    let foundSegment = false;

    for (const segment of path.segments) {
      if (segment.segmentId === position.segmentId) {
        // Calculate progress within this segment
        const segmentProgress = this.calculateSegmentProgress(position.matchedPosition, segment);
        progressDistance += segment.length * segmentProgress;
        foundSegment = true;
        break;
      } else {
        progressDistance += segment.length;
      }
      totalDistance += segment.length;
    }

    if (!foundSegment) {
      // Complete remaining segments
      for (const segment of path.segments) {
        totalDistance += segment.length;
      }
    }

    return totalDistance > 0 ? Math.min(1.0, progressDistance / totalDistance) : 0;
  }

  private calculateSegmentProgress(position: Point3D, segment: PathSegment): number {
    const segmentVector = {
      x: segment.endPoint.x - segment.startPoint.x,
      y: segment.endPoint.y - segment.startPoint.y,
      z: segment.endPoint.z - segment.startPoint.z
    };

    const positionVector = {
      x: position.x - segment.startPoint.x,
      y: position.y - segment.startPoint.y,
      z: position.z - segment.startPoint.z
    };

    const segmentLength = Math.sqrt(
      segmentVector.x ** 2 + segmentVector.y ** 2 + segmentVector.z ** 2
    );

    if (segmentLength === 0) return 0;

    const dotProduct = (
      positionVector.x * segmentVector.x +
      positionVector.y * segmentVector.y +
      positionVector.z * segmentVector.z
    );

    return Math.max(0, Math.min(1, dotProduct / (segmentLength ** 2)));
  }

  private estimateTimeToDestination(position: MatchedPosition, path: NavigationPath): number {
    const progress = this.calculatePathProgress(position, path);
    const remainingDistance = path.totalDistance * (1 - progress);
    const averageSpeed = 1.2; // m/s
    
    return remainingDistance / averageSpeed;
  }

  private getNextWaypoint(position: MatchedPosition, path: NavigationPath): Point3D | undefined {
    const currentProgress = this.calculatePathProgress(position, path);
    
    // Find next waypoint beyond current progress
    let accumulatedDistance = 0;
    for (const waypoint of path.waypoints) {
      const waypointProgress = accumulatedDistance / path.totalDistance;
      if (waypointProgress > currentProgress) {
        return waypoint;
      }
      // Approximate distance increment (simplified)
      accumulatedDistance += path.totalDistance / path.waypoints.length;
    }
    
    return undefined;
  }

  private getNextLandmark(position: MatchedPosition): Landmark | undefined {
    let closestLandmark: Landmark | undefined;
    let minDistance = Infinity;

    for (const landmark of this.landmarks.values()) {
      if (landmark.isVisible) {
        const distance = this.calculateDistance(position.matchedPosition, landmark.position);
        if (distance < minDistance && distance > 2.0) { // Must be ahead
          minDistance = distance;
          closestLandmark = landmark;
        }
      }
    }

    return minDistance < 20 ? closestLandmark : undefined; // Within 20 meters
  }

  // === NAVIGATION CONTROL ===

  startNavigation(targetZoneId: string): boolean {
    if (!this.venue || !this.currentState) return false;

    const targetZone = this.venue.zones.find(z => z.id === targetZoneId);
    if (!targetZone) return false;

    // Find path to target zone
    const currentZoneId = this.currentState.currentPosition.zoneId;
    if (!currentZoneId) return false;

    const pathId = `path_${currentZoneId}_to_${targetZoneId}`;
    const path = this.navigationPaths.get(pathId);
    
    if (!path) {
      console.error(`No path found from ${currentZoneId} to ${targetZoneId}`);
      return false;
    }

    this.currentState.targetZone = targetZoneId;
    this.currentState.activePath = path;
    this.currentState.progress = 0;

    console.log(`Navigation started to ${targetZone.name}`);
    return true;
  }

  stopNavigation(): void {
    if (this.currentState) {
      this.currentState.targetZone = undefined;
      this.currentState.activePath = undefined;
      this.currentState.progress = 0;
      this.currentState.nextWaypoint = undefined;
      this.currentState.nextLandmark = undefined;
    }
    console.log('Navigation stopped');
  }

  // === UTILITY METHODS ===

  private getZoneCenter(zone: Zone3D): Point3D {
    const avgX = zone.bounds.reduce((sum, p) => sum + p.x, 0) / zone.bounds.length;
    const avgY = zone.bounds.reduce((sum, p) => sum + p.y, 0) / zone.bounds.length;
    const avgZ = zone.bounds.reduce((sum, p) => sum + p.z, 0) / zone.bounds.length;
    
    return { x: avgX, y: avgY, z: avgZ };
  }

  private calculateDistance(p1: Point3D, p2: Point3D): number {
    return Math.sqrt(
      Math.pow(p2.x - p1.x, 2) +
      Math.pow(p2.y - p1.y, 2) +
      Math.pow(p2.z - p1.z, 2)
    );
  }

  private calculateBearing(from: Point3D, to: Point3D): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const bearing = Math.atan2(dy, dx) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  private distanceToLineSegment(point: Point3D, lineStart: Point3D, lineEnd: Point3D): number {
    const projected = this.projectPointToSegment(point, lineStart, lineEnd);
    return this.calculateDistance(point, projected);
  }

  private projectPointToSegment(point: Point3D, lineStart: Point3D, lineEnd: Point3D): Point3D {
    const segmentVector = {
      x: lineEnd.x - lineStart.x,
      y: lineEnd.y - lineStart.y,
      z: lineEnd.z - lineStart.z
    };

    const pointVector = {
      x: point.x - lineStart.x,
      y: point.y - lineStart.y,
      z: point.z - lineStart.z
    };

    const segmentLengthSquared = 
      segmentVector.x ** 2 + segmentVector.y ** 2 + segmentVector.z ** 2;

    if (segmentLengthSquared === 0) {
      return { ...lineStart };
    }

    const t = Math.max(0, Math.min(1, 
      (pointVector.x * segmentVector.x + 
       pointVector.y * segmentVector.y + 
       pointVector.z * segmentVector.z) / segmentLengthSquared
    ));

    return {
      x: lineStart.x + t * segmentVector.x,
      y: lineStart.y + t * segmentVector.y,
      z: lineStart.z + t * segmentVector.z
    };
  }

  private estimateSpeed(): number {
    if (this.positionHistory.length < 2) return 0;

    const recent = this.positionHistory.slice(-5); // Last 5 positions
    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 1; i < recent.length; i++) {
      const distance = this.calculateDistance(
        recent[i-1].matchedPosition,
        recent[i].matchedPosition
      );
      const time = (recent[i].timestamp - recent[i-1].timestamp) / 1000;
      
      totalDistance += distance;
      totalTime += time;
    }

    return totalTime > 0 ? totalDistance / totalTime : 0;
  }

  private estimatePathTime(distance: number, floorChanges: number): number {
    const walkingTime = distance / 1.2; // 1.2 m/s average speed
    const floorTime = floorChanges * 45; // 45 seconds per floor change
    return walkingTime + floorTime;
  }

  private assessPathDifficulty(distance: number, floorChanges: number): 'easy' | 'medium' | 'hard' {
    if (distance < 30 && floorChanges === 0) return 'easy';
    if (distance < 100 && floorChanges <= 2) return 'medium';
    return 'hard';
  }

  // === PUBLIC API ===

  setPositionCallback(callback: (position: MatchedPosition) => void): void {
    this.positionCallback = callback;
  }

  setNavigationCallback(callback: (state: NavigationState) => void): void {
    this.navigationCallback = callback;
  }

  setPathDeviationCallback(callback: (deviation: number) => void): void {
    this.pathDeviationCallback = callback;
  }

  getCurrentState(): NavigationState | null {
    return this.currentState;
  }

  getNavigationPaths(): NavigationPath[] {
    return Array.from(this.navigationPaths.values());
  }

  getLandmarks(): Landmark[] {
    return Array.from(this.landmarks.values());
  }

  getConfig(): MapMatchingConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<MapMatchingConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('Map matching configuration updated');
  }

  // === ANALYTICS ===

  getMatchingStatistics(): {
    averageConfidence: number;
    averageDeviation: number;
    matchingAccuracy: number;
    pathCoverage: number;
  } {
    const recentPositions = this.positionHistory.slice(-100);
    
    const averageConfidence = recentPositions.length > 0
      ? recentPositions.reduce((sum, p) => sum + p.confidence, 0) / recentPositions.length
      : 0;

    const averageDeviation = recentPositions.length > 0
      ? recentPositions.reduce((sum, p) => sum + p.distanceToPath, 0) / recentPositions.length
      : 0;

    const matchedPositions = recentPositions.filter(p => p.pathId || p.segmentId);
    const matchingAccuracy = recentPositions.length > 0
      ? matchedPositions.length / recentPositions.length
      : 0;

    const pathCoverage = this.navigationPaths.size > 0
      ? new Set(recentPositions.map(p => p.pathId).filter(Boolean)).size / this.navigationPaths.size
      : 0;

    return {
      averageConfidence,
      averageDeviation,
      matchingAccuracy,
      pathCoverage
    };
  }
}

export default MapMatchingService;
export type {
  NavigationPath,
  PathSegment,
  Landmark,
  MatchedPosition,
  NavigationState,
  MapMatchingConfig
};
