import * as Location from 'expo-location';
import { Order, GeoPoint } from '../types/order';
import { MeshNetworkService } from './MeshNetworkService';
import Spatial3DService from './Spatial3DService';
import ShipDetectionService from './ShipDetectionService';

export interface BarLocation {
  id: string;
  name: string;
  position: GeoPoint;
  zone?: string; // e.g., "main_bar", "pool_bar", "deck_5_bar"
  capacity: number; // max concurrent orders
  currentLoad: number; // current active orders
  staffCount: number;
  isActive: boolean;
  specialties?: string[]; // e.g., ["cocktails", "beer", "wine"]
  deckLevel?: number; // for cruise ships
}

export interface RouteOptimization {
  orderId: string;
  customerPosition: GeoPoint;
  assignedBarId: string;
  assignedBarName: string;
  distance: number; // meters
  estimatedDeliveryTime: number; // seconds
  routingReason: string;
  alternativeBars: Array<{
    barId: string;
    name: string;
    distance: number;
    estimatedTime: number;
    reason: string;
  }>;
  confidence: number; // 0-100%
}

export interface OrderRoutingConfig {
  onOrderRouted?: (optimization: RouteOptimization) => void;
  onBarLoadChanged?: (barId: string, load: number) => void;
  maxDeliveryDistance?: number; // meters
  loadBalancingEnabled?: boolean;
  shipModeEnabled?: boolean;
}

class OrderRoutingService {
  private static instance: OrderRoutingService;
  private config: OrderRoutingConfig;
  private bars: Map<string, BarLocation> = new Map();
  private meshService: MeshNetworkService | null = null;
  private spatialService: Spatial3DService | null = null;
  private routingHistory: Map<string, RouteOptimization> = new Map();

  constructor(config: OrderRoutingConfig = {}) {
    this.config = {
      maxDeliveryDistance: 100, // 100 meters max
      loadBalancingEnabled: true,
      shipModeEnabled: false,
      ...config
    };

    this.initializeDefaultBars();
  }

  static getInstance(config?: OrderRoutingConfig): OrderRoutingService {
    if (!OrderRoutingService.instance) {
      OrderRoutingService.instance = new OrderRoutingService(config);
    }
    return OrderRoutingService.instance;
  }

  private initializeDefaultBars(): void {
    // Default bar configurations for different venue types
    const defaultBars: BarLocation[] = [
      {
        id: 'main_bar_001',
        name: 'Main Bar',
        position: { latitude: 25.7612, longitude: -80.1923, timestamp: Date.now() },
        zone: 'main_bar',
        capacity: 20,
        currentLoad: 0,
        staffCount: 3,
        isActive: true,
        specialties: ['cocktails', 'beer', 'wine', 'spirits']
      },
      {
        id: 'pool_bar_001',
        name: 'Pool Bar',
        position: { latitude: 25.7615, longitude: -80.1920, timestamp: Date.now() },
        zone: 'pool_area',
        capacity: 15,
        currentLoad: 0,
        staffCount: 2,
        isActive: true,
        specialties: ['beer', 'cocktails', 'frozen_drinks']
      },
      {
        id: 'sports_bar_001',
        name: 'Sports Bar',
        position: { latitude: 25.7610, longitude: -80.1925, timestamp: Date.now() },
        zone: 'entertainment',
        capacity: 12,
        currentLoad: 0,
        staffCount: 2,
        isActive: true,
        specialties: ['beer', 'wings', 'spirits']
      }
    ];

    defaultBars.forEach(bar => this.bars.set(bar.id, bar));
  }

  // Initialize for cruise ship mode with deck-specific bars
  initializeCruiseShipBars(shipSettings: any): void {
    this.config.shipModeEnabled = true;
    
    const cruiseBars: BarLocation[] = [
      // Deck 5 - Main dining level
      {
        id: 'deck5_main_bar',
        name: 'Deck 5 Main Bar',
        position: { latitude: 25.7612, longitude: -80.1923, timestamp: Date.now() },
        zone: 'main_dining',
        capacity: 25,
        currentLoad: 0,
        staffCount: 4,
        isActive: true,
        deckLevel: 5,
        specialties: ['cocktails', 'wine', 'beer', 'spirits']
      },
      // Deck 9 - Pool deck
      {
        id: 'deck9_pool_bar',
        name: 'Deck 9 Pool Bar',
        position: { latitude: 25.7615, longitude: -80.1920, timestamp: Date.now() },
        zone: 'pool_deck',
        capacity: 20,
        currentLoad: 0,
        staffCount: 3,
        isActive: true,
        deckLevel: 9,
        specialties: ['frozen_drinks', 'beer', 'cocktails']
      },
      // Deck 12 - Sky bar
      {
        id: 'deck12_sky_bar',
        name: 'Deck 12 Sky Bar',
        position: { latitude: 25.7608, longitude: -80.1918, timestamp: Date.now() },
        zone: 'sky_deck',
        capacity: 15,
        currentLoad: 0,
        staffCount: 2,
        isActive: true,
        deckLevel: 12,
        specialties: ['premium_cocktails', 'wine', 'champagne']
      },
      // Deck 7 - Sports bar
      {
        id: 'deck7_sports_bar',
        name: 'Deck 7 Sports Bar',
        position: { latitude: 25.7610, longitude: -80.1925, timestamp: Date.now() },
        zone: 'entertainment',
        capacity: 18,
        currentLoad: 0,
        staffCount: 3,
        isActive: true,
        deckLevel: 7,
        specialties: ['beer', 'spirits', 'pub_food']
      }
    ];

    // Clear existing bars and add cruise ship bars
    this.bars.clear();
    cruiseBars.forEach(bar => this.bars.set(bar.id, bar));

    console.log(`Initialized ${cruiseBars.length} cruise ship bars`);
  }

  // Add or update a bar location
  addBar(bar: BarLocation): void {
    this.bars.set(bar.id, bar);
    console.log(`Added bar: ${bar.name} at ${bar.zone}`);
  }

  // Remove a bar
  removeBar(barId: string): void {
    this.bars.delete(barId);
    console.log(`Removed bar: ${barId}`);
  }

  // Update bar status (active/inactive, load, staff)
  updateBarStatus(barId: string, updates: Partial<BarLocation>): void {
    const bar = this.bars.get(barId);
    if (bar) {
      Object.assign(bar, updates);
      this.config.onBarLoadChanged?.(barId, bar.currentLoad);
    }
  }

  // Main order routing function
  async routeOrder(order: Order): Promise<RouteOptimization> {
    const customerPosition = order.currentLocation || order.origin;
    
    // Get all active bars
    const activeBars = Array.from(this.bars.values()).filter(bar => bar.isActive);
    
    if (activeBars.length === 0) {
      throw new Error('No active bars available');
    }

    // Calculate distances and delivery times for all bars
    const barAnalysis = await Promise.all(
      activeBars.map(async (bar) => {
        const distance = this.calculateDistance(customerPosition, bar.position);
        const deliveryTime = await this.estimateDeliveryTime(
          customerPosition, 
          bar, 
          distance
        );
        
        return {
          bar,
          distance,
          deliveryTime,
          score: this.calculateBarScore(bar, distance, deliveryTime)
        };
      })
    );

    // Filter bars within max delivery distance
    const viableBars = barAnalysis.filter(
      analysis => analysis.distance <= (this.config.maxDeliveryDistance || 100)
    );

    if (viableBars.length === 0) {
      throw new Error('No bars within delivery range');
    }

    // Sort by score (best first)
    viableBars.sort((a, b) => b.score - a.score);

    const bestBar = viableBars[0];
    const assignedBar = bestBar.bar;

    // Update bar load
    assignedBar.currentLoad++;
    this.config.onBarLoadChanged?.(assignedBar.id, assignedBar.currentLoad);

    // Create optimization result
    const optimization: RouteOptimization = {
      orderId: order.id,
      customerPosition,
      assignedBarId: assignedBar.id,
      assignedBarName: assignedBar.name,
      distance: bestBar.distance,
      estimatedDeliveryTime: bestBar.deliveryTime,
      routingReason: this.getRoutingReason(bestBar, viableBars),
      alternativeBars: viableBars.slice(1, 4).map(analysis => ({
        barId: analysis.bar.id,
        name: analysis.bar.name,
        distance: analysis.distance,
        estimatedTime: analysis.deliveryTime,
        reason: `Distance: ${analysis.distance.toFixed(0)}m, Load: ${analysis.bar.currentLoad}`
      })),
      confidence: this.calculateRoutingConfidence(bestBar, viableBars)
    };

    // Store routing history
    this.routingHistory.set(order.id, optimization);

    // Notify callback
    this.config.onOrderRouted?.(optimization);

    console.log(`Order ${order.id} routed to ${assignedBar.name} (${bestBar.distance.toFixed(0)}m, ${bestBar.deliveryTime}s)`);
    
    return optimization;
  }

  private calculateDistance(pos1: GeoPoint, pos2: GeoPoint): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const dLng = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(pos1.latitude * Math.PI / 180) * Math.cos(pos2.latitude * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private async estimateDeliveryTime(
    customerPos: GeoPoint, 
    bar: BarLocation, 
    distance: number
  ): Promise<number> {
    // Base delivery time (walking speed ~1.4 m/s)
    let baseTime = distance / 1.4;

    // Add preparation time based on bar load
    const prepTime = 60 + (bar.currentLoad * 30); // 60s base + 30s per order

    // Add deck traversal time for cruise ships
    if (this.config.shipModeEnabled && bar.deckLevel) {
      const currentDeck = await this.estimateCustomerDeck(customerPos);
      if (currentDeck && currentDeck !== bar.deckLevel) {
        const deckDifference = Math.abs(currentDeck - bar.deckLevel);
        baseTime += deckDifference * 45; // 45 seconds per deck level
      }
    }

    // Staff efficiency multiplier
    const staffMultiplier = Math.max(0.5, 1 - (bar.staffCount - 1) * 0.1);

    return Math.round((baseTime + prepTime) * staffMultiplier);
  }

  private async estimateCustomerDeck(position: GeoPoint): Promise<number | null> {
    if (!this.config.shipModeEnabled) return null;
    
    // Use altitude to estimate deck level (3.5m per deck average)
    if (position.altitude) {
      const seaLevel = 15; // Approximate ship base above sea level
      const deckHeight = 3.5;
      return Math.round((position.altitude - seaLevel) / deckHeight);
    }
    
    return null;
  }

  private calculateBarScore(bar: BarLocation, distance: number, deliveryTime: number): number {
    let score = 100;

    // Distance penalty (closer is better)
    score -= (distance / 10); // -1 point per 10 meters

    // Load penalty (less loaded is better)
    const loadRatio = bar.currentLoad / bar.capacity;
    score -= loadRatio * 30; // Up to -30 points for full capacity

    // Staff bonus (more staff is better)
    score += bar.staffCount * 5; // +5 points per staff member

    // Delivery time penalty
    score -= deliveryTime / 10; // -1 point per 10 seconds

    // Active bonus
    if (!bar.isActive) score -= 50;

    return Math.max(0, score);
  }

  private getRoutingReason(bestBar: any, allBars: any[]): string {
    const { bar, distance, deliveryTime } = bestBar;
    
    if (allBars.length === 1) {
      return 'Only available bar';
    }
    
    const secondBest = allBars[1];
    const distanceAdvantage = secondBest.distance - distance;
    const timeAdvantage = secondBest.deliveryTime - deliveryTime;
    
    if (distanceAdvantage > 20) {
      return `Closest bar (${distanceAdvantage.toFixed(0)}m closer)`;
    }
    
    if (timeAdvantage > 60) {
      return `Fastest delivery (${Math.round(timeAdvantage/60)}min faster)`;
    }
    
    if (bar.currentLoad < secondBest.bar.currentLoad) {
      return `Lower workload (${secondBest.bar.currentLoad - bar.currentLoad} fewer orders)`;
    }
    
    return `Best overall option`;
  }

  private calculateRoutingConfidence(bestBar: any, allBars: any[]): number {
    if (allBars.length === 1) return 100;
    
    const scoreGap = bestBar.score - allBars[1].score;
    return Math.min(100, Math.max(50, 50 + scoreGap));
  }

  // Get routing statistics
  getRoutingStats(): {
    totalOrders: number;
    barUtilization: Map<string, number>;
    averageDeliveryDistance: number;
    averageDeliveryTime: number;
  } {
    const orders = Array.from(this.routingHistory.values());
    const barUtilization = new Map<string, number>();
    
    // Calculate bar utilization
    this.bars.forEach(bar => {
      const utilization = (bar.currentLoad / bar.capacity) * 100;
      barUtilization.set(bar.id, utilization);
    });
    
    const avgDistance = orders.reduce((sum, opt) => sum + opt.distance, 0) / orders.length || 0;
    const avgTime = orders.reduce((sum, opt) => sum + opt.estimatedDeliveryTime, 0) / orders.length || 0;
    
    return {
      totalOrders: orders.length,
      barUtilization,
      averageDeliveryDistance: avgDistance,
      averageDeliveryTime: avgTime
    };
  }

  // Complete an order (reduce bar load)
  completeOrder(orderId: string): void {
    const routing = this.routingHistory.get(orderId);
    if (routing) {
      const bar = this.bars.get(routing.assignedBarId);
      if (bar && bar.currentLoad > 0) {
        bar.currentLoad--;
        this.config.onBarLoadChanged?.(bar.id, bar.currentLoad);
        console.log(`Order ${orderId} completed at ${bar.name}, load now: ${bar.currentLoad}`);
      }
    }
  }

  // Get all bars with their current status
  getAllBars(): BarLocation[] {
    return Array.from(this.bars.values());
  }

  // Get routing history for an order
  getOrderRouting(orderId: string): RouteOptimization | null {
    return this.routingHistory.get(orderId) || null;
  }
}

export default OrderRoutingService;
export type { BarLocation, RouteOptimization, OrderRoutingConfig };
