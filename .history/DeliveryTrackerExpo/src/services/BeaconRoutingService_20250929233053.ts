import { Zone3D, BeaconAnchor, Point3D } from './Venue3DMapService';
import { BeaconReading } from './EnhancedARVIOService';

// Beacon-based routing and UUID management for phone-to-bar delivery
export interface PhoneBeacon {
  phoneId: string;
  uuid: string;
  major: number;
  minor: number;
  userId: string;
  userName?: string;
  isActive: boolean;
  lastSeen: number;
  position?: Point3D;
  zoneId?: string;
  batteryLevel?: number;
  signalStrength: number;
}

export interface BarStation {
  barId: string;
  name: string;
  uuid: string;
  major: number;
  minor: number;
  position: Point3D;
  zoneId: string;
  staffMembers: string[];
  isActive: boolean;
  capacity: number;
  currentOrders: string[];
  priority: number; // 1 = highest priority
  operatingHours: {
    start: string;
    end: string;
  };
}

export interface DeliveryRoute {
  routeId: string;
  fromBar: string;
  toPhone: string;
  distance: number;
  estimatedTime: number; // seconds
  difficulty: 'easy' | 'medium' | 'hard';
  waypoints: Point3D[];
  instructions: string[];
  priority: number;
  createdAt: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
}

export interface ProximityAlert {
  alertId: string;
  phoneId: string;
  barId: string;
  distance: number;
  timestamp: number;
  type: 'approaching' | 'arrived' | 'departed';
  orderId?: string;
}

export interface BeaconNetwork {
  networkId: string;
  venueId: string;
  phones: Map<string, PhoneBeacon>;
  bars: Map<string, BarStation>;
  routes: Map<string, DeliveryRoute>;
  proximityThresholds: {
    close: number;    // meters
    arrived: number;  // meters
    departed: number; // meters
  };
}

class BeaconRoutingService {
  private static instance: BeaconRoutingService;
  private network: BeaconNetwork;
  private routeUpdateCallback: ((route: DeliveryRoute) => void) | null = null;
  private proximityCallback: ((alert: ProximityAlert) => void) | null = null;
  private routeIdCounter: number = 1;
  private alertIdCounter: number = 1;

  static getInstance(): BeaconRoutingService {
    if (!BeaconRoutingService.instance) {
      BeaconRoutingService.instance = new BeaconRoutingService();
    }
    return BeaconRoutingService.instance;
  }

  constructor() {
    this.network = {
      networkId: `network_${Date.now()}`,
      venueId: '',
      phones: new Map(),
      bars: new Map(),
      routes: new Map(),
      proximityThresholds: {
        close: 10.0,    // 10 meters
        arrived: 3.0,   // 3 meters
        departed: 15.0  // 15 meters
      }
    };
  }

  // === NETWORK INITIALIZATION ===

  initializeNetwork(venueId: string, bars: Zone3D[], beacons: BeaconAnchor[]): void {
    this.network.venueId = venueId;
    this.network.bars.clear();

    // Initialize bar stations from venue zones
    bars.filter(zone => zone.type === 'bar' && zone.isActive).forEach(bar => {
      const barBeacons = beacons.filter(beacon => 
        bar.beaconUUIDs.includes(beacon.uuid) && beacon.isActive
      );

      if (barBeacons.length > 0) {
        const primaryBeacon = barBeacons[0]; // Use first beacon as primary
        
        const barStation: BarStation = {
          barId: bar.id,
          name: bar.name,
          uuid: primaryBeacon.uuid,
          major: primaryBeacon.major,
          minor: primaryBeacon.minor,
          position: primaryBeacon.position,
          zoneId: bar.id,
          staffMembers: bar.metadata.staffAssigned || [],
          isActive: true,
          capacity: bar.capacity,
          currentOrders: [],
          priority: bar.priority,
          operatingHours: bar.metadata.operatingHours || { start: '00:00', end: '23:59' }
        };

        this.network.bars.set(bar.id, barStation);
      }
    });

    console.log(`Beacon network initialized for venue ${venueId} with ${this.network.bars.size} bars`);
  }

  // === PHONE BEACON MANAGEMENT ===

  registerPhoneBeacon(phoneId: string, userId: string, userName?: string): PhoneBeacon {
    // Generate unique UUID for this phone
    const uuid = this.generatePhoneUUID(phoneId);
    const major = Math.floor(Math.random() * 65535) + 1;
    const minor = Math.floor(Math.random() * 65535) + 1;

    const phoneBeacon: PhoneBeacon = {
      phoneId,
      uuid,
      major,
      minor,
      userId,
      userName,
      isActive: true,
      lastSeen: Date.now(),
      signalStrength: -50 // Default RSSI
    };

    this.network.phones.set(phoneId, phoneBeacon);
    console.log(`Phone beacon registered: ${phoneId} (${uuid})`);
    
    return phoneBeacon;
  }

  updatePhonePosition(phoneId: string, position: Point3D, zoneId?: string): boolean {
    const phone = this.network.phones.get(phoneId);
    if (!phone) return false;

    phone.position = { ...position };
    phone.zoneId = zoneId;
    phone.lastSeen = Date.now();

    // Check for proximity alerts
    this.checkProximityAlerts(phoneId);

    return true;
  }

  updatePhoneBeaconReading(phoneId: string, reading: BeaconReading): void {
    const phone = this.network.phones.get(phoneId);
    if (!phone) return;

    phone.signalStrength = reading.rssi;
    phone.lastSeen = Date.now();

    // Update position based on beacon triangulation if available
    // This would integrate with the AR/VIO service for position fusion
  }

  deactivatePhoneBeacon(phoneId: string): boolean {
    const phone = this.network.phones.get(phoneId);
    if (!phone) return false;

    phone.isActive = false;
    phone.lastSeen = Date.now();
    
    console.log(`Phone beacon deactivated: ${phoneId}`);
    return true;
  }

  private generatePhoneUUID(phoneId: string): string {
    // Generate a consistent UUID based on phone ID
    // In practice, use a proper UUID generation library
    const hash = this.simpleHash(phoneId);
    return `phone-${hash.toString(16).padStart(8, '0')}-beacon`;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // === BAR STATION MANAGEMENT ===

  updateBarStation(barId: string, updates: Partial<BarStation>): boolean {
    const bar = this.network.bars.get(barId);
    if (!bar) return false;

    Object.assign(bar, updates);
    console.log(`Bar station updated: ${barId}`);
    return true;
  }

  addOrderToBar(barId: string, orderId: string): boolean {
    const bar = this.network.bars.get(barId);
    if (!bar) return false;

    if (!bar.currentOrders.includes(orderId)) {
      bar.currentOrders.push(orderId);
    }
    return true;
  }

  removeOrderFromBar(barId: string, orderId: string): boolean {
    const bar = this.network.bars.get(barId);
    if (!bar) return false;

    bar.currentOrders = bar.currentOrders.filter(id => id !== orderId);
    return true;
  }

  // === ROUTING ALGORITHMS ===

  findOptimalBar(phoneId: string, orderPriority: number = 1): BarStation | null {
    const phone = this.network.phones.get(phoneId);
    if (!phone || !phone.position) return null;

    const activeBars = Array.from(this.network.bars.values())
      .filter(bar => bar.isActive && this.isBarOperating(bar));

    if (activeBars.length === 0) return null;

    // Score bars based on multiple factors
    const scoredBars = activeBars.map(bar => {
      const distance = this.calculateDistance(phone.position!, bar.position);
      const load = bar.currentOrders.length / bar.capacity;
      const priorityMatch = bar.priority <= orderPriority ? 1.0 : 0.5;
      
      // Scoring formula (lower is better)
      const score = distance * 0.4 + load * 30 + (1 - priorityMatch) * 20;
      
      return { bar, score, distance, load };
    });

    // Sort by score (ascending)
    scoredBars.sort((a, b) => a.score - b.score);
    
    const optimalBar = scoredBars[0];
    console.log(`Optimal bar for ${phoneId}: ${optimalBar.bar.name} (score: ${optimalBar.score.toFixed(2)})`);
    
    return optimalBar.bar;
  }

  createDeliveryRoute(fromBarId: string, toPhoneId: string, orderId?: string): DeliveryRoute | null {
    const bar = this.network.bars.get(fromBarId);
    const phone = this.network.phones.get(toPhoneId);

    if (!bar || !phone || !phone.position) return null;

    const routeId = `route_${this.routeIdCounter++}`;
    const distance = this.calculateDistance(bar.position, phone.position!);
    const estimatedTime = this.estimateDeliveryTime(bar.position, phone.position!, distance);
    const difficulty = this.assessRouteDifficulty(bar.position, phone.position!);

    const route: DeliveryRoute = {
      routeId,
      fromBar: fromBarId,
      toPhone: toPhoneId,
      distance,
      estimatedTime,
      difficulty,
      waypoints: [bar.position, phone.position!],
      instructions: this.generateRouteInstructions(bar, phone),
      priority: bar.priority,
      createdAt: Date.now(),
      status: 'pending'
    };

    this.network.routes.set(routeId, route);
    
    if (this.routeUpdateCallback) {
      this.routeUpdateCallback(route);
    }

    console.log(`Delivery route created: ${routeId} (${bar.name} → ${phone.userName || phone.userId})`);
    return route;
  }

  updateRouteStatus(routeId: string, status: DeliveryRoute['status']): boolean {
    const route = this.network.routes.get(routeId);
    if (!route) return false;

    route.status = status;
    
    if (this.routeUpdateCallback) {
      this.routeUpdateCallback(route);
    }

    console.log(`Route ${routeId} status updated: ${status}`);
    return true;
  }

  private isBarOperating(bar: BarStation): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Simple time comparison (in practice, handle day boundaries)
    return currentTime >= bar.operatingHours.start && currentTime <= bar.operatingHours.end;
  }

  private calculateDistance(pos1: Point3D, pos2: Point3D): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }

  private estimateDeliveryTime(from: Point3D, to: Point3D, distance: number): number {
    // Base walking speed: 1.5 m/s
    // Add time for floor changes: 30s per floor
    const floorChanges = Math.abs(to.z - from.z) / 3.5; // 3.5m per floor
    const walkingTime = distance / 1.5;
    const floorTime = floorChanges * 30;
    
    return Math.round(walkingTime + floorTime);
  }

  private assessRouteDifficulty(from: Point3D, to: Point3D): 'easy' | 'medium' | 'hard' {
    const distance = this.calculateDistance(from, to);
    const floorChanges = Math.abs(to.z - from.z) / 3.5;
    
    if (distance < 20 && floorChanges === 0) return 'easy';
    if (distance < 50 && floorChanges <= 2) return 'medium';
    return 'hard';
  }

  private generateRouteInstructions(bar: BarStation, phone: PhoneBeacon): string[] {
    const instructions: string[] = [];
    
    instructions.push(`Start from ${bar.name}`);
    
    if (phone.zoneId) {
      instructions.push(`Navigate to ${phone.zoneId}`);
    } else if (phone.position) {
      const floorDiff = Math.round((phone.position.z - bar.position.z) / 3.5);
      if (floorDiff > 0) {
        instructions.push(`Go up ${floorDiff} floor${floorDiff > 1 ? 's' : ''}`);
      } else if (floorDiff < 0) {
        instructions.push(`Go down ${Math.abs(floorDiff)} floor${Math.abs(floorDiff) > 1 ? 's' : ''}`);
      }
      
      instructions.push(`Proceed to customer location`);
    }
    
    instructions.push(`Deliver to ${phone.userName || phone.userId}`);
    
    return instructions;
  }

  // === PROXIMITY DETECTION ===

  private checkProximityAlerts(phoneId: string): void {
    const phone = this.network.phones.get(phoneId);
    if (!phone || !phone.position) return;

    // Check proximity to all bars
    for (const [barId, bar] of this.network.bars.entries()) {
      const distance = this.calculateDistance(phone.position, bar.position);
      
      // Generate appropriate alerts based on distance thresholds
      if (distance <= this.network.proximityThresholds.arrived) {
        this.generateProximityAlert(phoneId, barId, distance, 'arrived');
      } else if (distance <= this.network.proximityThresholds.close) {
        this.generateProximityAlert(phoneId, barId, distance, 'approaching');
      } else if (distance >= this.network.proximityThresholds.departed) {
        this.generateProximityAlert(phoneId, barId, distance, 'departed');
      }
    }
  }

  private generateProximityAlert(
    phoneId: string, 
    barId: string, 
    distance: number, 
    type: ProximityAlert['type']
  ): void {
    const alertId = `alert_${this.alertIdCounter++}`;
    
    const alert: ProximityAlert = {
      alertId,
      phoneId,
      barId,
      distance,
      timestamp: Date.now(),
      type
    };

    if (this.proximityCallback) {
      this.proximityCallback(alert);
    }

    console.log(`Proximity alert: ${phoneId} ${type} ${barId} (${distance.toFixed(1)}m)`);
  }

  // === NETWORK OPTIMIZATION ===

  optimizeNetwork(): void {
    const now = Date.now();
    
    // Clean up inactive phones (not seen for 5 minutes)
    const phoneTimeout = 5 * 60 * 1000;
    for (const [phoneId, phone] of this.network.phones.entries()) {
      if (now - phone.lastSeen > phoneTimeout) {
        this.network.phones.delete(phoneId);
        console.log(`Removed inactive phone: ${phoneId}`);
      }
    }

    // Clean up old routes (completed/cancelled routes older than 1 hour)
    const routeTimeout = 60 * 60 * 1000;
    for (const [routeId, route] of this.network.routes.entries()) {
      if ((route.status === 'completed' || route.status === 'cancelled') &&
          now - route.createdAt > routeTimeout) {
        this.network.routes.delete(routeId);
        console.log(`Removed old route: ${routeId}`);
      }
    }

    // Rebalance bar loads if needed
    this.rebalanceBarLoads();
  }

  private rebalanceBarLoads(): void {
    const bars = Array.from(this.network.bars.values()).filter(bar => bar.isActive);
    const avgLoad = bars.reduce((sum, bar) => sum + bar.currentOrders.length, 0) / bars.length;
    
    // Identify overloaded bars
    const overloadedBars = bars.filter(bar => bar.currentOrders.length > avgLoad * 1.5);
    
    if (overloadedBars.length > 0) {
      console.log(`Rebalancing loads for ${overloadedBars.length} overloaded bars`);
      // In practice, implement load balancing logic here
    }
  }

  // === PUBLIC API ===

  setRouteUpdateCallback(callback: (route: DeliveryRoute) => void): void {
    this.routeUpdateCallback = callback;
  }

  setProximityCallback(callback: (alert: ProximityAlert) => void): void {
    this.proximityCallback = callback;
  }

  getNetworkStatus(): {
    phones: number;
    bars: number;
    activeRoutes: number;
    totalRoutes: number;
  } {
    const activeRoutes = Array.from(this.network.routes.values())
      .filter(route => route.status === 'pending' || route.status === 'in_progress').length;

    return {
      phones: this.network.phones.size,
      bars: this.network.bars.size,
      activeRoutes,
      totalRoutes: this.network.routes.size
    };
  }

  getPhoneBeacon(phoneId: string): PhoneBeacon | null {
    return this.network.phones.get(phoneId) || null;
  }

  getBarStation(barId: string): BarStation | null {
    return this.network.bars.get(barId) || null;
  }

  getAllBars(): BarStation[] {
    return Array.from(this.network.bars.values());
  }

  getAllPhones(): PhoneBeacon[] {
    return Array.from(this.network.phones.values());
  }

  getActiveRoutes(): DeliveryRoute[] {
    return Array.from(this.network.routes.values())
      .filter(route => route.status === 'pending' || route.status === 'in_progress');
  }

  getRoute(routeId: string): DeliveryRoute | null {
    return this.network.routes.get(routeId) || null;
  }

  // === ANALYTICS ===

  getDeliveryAnalytics(): {
    averageDeliveryTime: number;
    successRate: number;
    busyBars: string[];
    peakHours: number[];
  } {
    const completedRoutes = Array.from(this.network.routes.values())
      .filter(route => route.status === 'completed');

    const averageDeliveryTime = completedRoutes.length > 0 
      ? completedRoutes.reduce((sum, route) => sum + route.estimatedTime, 0) / completedRoutes.length
      : 0;

    const totalRoutes = this.network.routes.size;
    const successRate = totalRoutes > 0 ? completedRoutes.length / totalRoutes : 0;

    const busyBars = Array.from(this.network.bars.values())
      .filter(bar => bar.currentOrders.length > bar.capacity * 0.7)
      .map(bar => bar.name);

    return {
      averageDeliveryTime,
      successRate,
      busyBars,
      peakHours: [] // Would analyze historical data
    };
  }
}

export default BeaconRoutingService;
