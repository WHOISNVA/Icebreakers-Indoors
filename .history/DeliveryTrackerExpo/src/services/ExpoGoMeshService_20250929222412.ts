import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Point3D, GeoPoint3D } from './Spatial3DService';

// Expo Go compatible mesh network using AsyncStorage and simulated networking
export interface MeshNode {
  id: string;
  type: 'mobile' | 'bar_station' | 'access_point' | 'beacon_hub';
  position: Point3D;
  geoPosition?: GeoPoint3D;
  ipAddress?: string;
  capabilities: NodeCapabilities;
  lastSeen: number;
  signalStrength: number;
  batteryLevel?: number;
  status: 'online' | 'offline' | 'degraded';
}

export interface NodeCapabilities {
  canTriangulate: boolean;
  hasGPS: boolean;
  hasUWB: boolean;
  hasBLE: boolean;
  hasWiFi: boolean;
  canProcessOrders: boolean;
  isBarStation: boolean;
  isPhoneBeacon: boolean;
}

export interface MeshConnection {
  fromNodeId: string;
  toNodeId: string;
  signalStrength: number;
  latency: number;
  bandwidth: number;
  reliability: number;
  lastUpdate: number;
}

export interface TriangulationRequest {
  id: string;
  requesterId: string;
  targetPosition?: Point3D;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requiredAccuracy: number;
}

export interface DeliveryOptimization {
  customerId: string;
  customerPosition: Point3D;
  nearestBars: Array<{
    barId: string;
    position: Point3D;
    distance: number;
    estimatedDeliveryTime: number;
    staffAvailable: boolean;
    currentLoad: number;
  }>;
  recommendedBar: string;
  estimatedTotalTime: number;
}

export interface ExpoGoMeshConfig {
  onNodeDiscovered?: (node: MeshNode) => void;
  onNodeLost?: (nodeId: string) => void;
  onTriangulationRequest?: (request: TriangulationRequest) => void;
  onDeliveryOptimization?: (optimization: DeliveryOptimization) => void;
  nodeId?: string;
  nodeType?: MeshNode['type'];
  enableAutoDiscovery?: boolean;
  discoveryInterval?: number;
  maxNodeAge?: number;
}

export class ExpoGoMeshService {
  private config: ExpoGoMeshConfig;
  private _isActive: boolean = false;
  
  // Network topology using AsyncStorage for persistence
  private localNode: MeshNode;
  private knownNodes: Map<string, MeshNode> = new Map();
  private connections: Map<string, MeshConnection> = new Map();
  
  // Discovery and simulation
  private discoveryInterval: any = null;
  private heartbeatInterval: any = null;
  private simulationInterval: any = null;
  
  // Bar network management
  private barStations: Map<string, MeshNode> = new Map();
  private deliveryQueue: Array<{orderId: string, customerId: string, priority: number}> = [];

  constructor(config: ExpoGoMeshConfig = {}) {
    this.config = {
      nodeType: 'mobile',
      enableAutoDiscovery: true,
      discoveryInterval: 5000,
      maxNodeAge: 30000,
      ...config
    };

    this.localNode = this.createLocalNode();
    this.initializeBarStations();
  }

  private generateNodeId(): string {
    return `expo_node_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createLocalNode(): MeshNode {
    return {
      id: this.config.nodeId || this.generateNodeId(),
      type: this.config.nodeType || 'mobile',
      position: { x: 0, y: 0, z: 0, timestamp: Date.now() },
      capabilities: {
        canTriangulate: true,
        hasGPS: true,
        hasUWB: false, // Not available in Expo Go
        hasBLE: false, // Limited in Expo Go
        hasWiFi: true,
        canProcessOrders: this.config.nodeType === 'bar_station',
        isBarStation: this.config.nodeType === 'bar_station',
        isPhoneBeacon: this.config.nodeType === 'mobile'
      },
      lastSeen: Date.now(),
      signalStrength: -50, // Good signal
      batteryLevel: 85,
      status: 'online'
    };
  }

  private initializeBarStations(): void {
    // Create simulated bar stations for the mesh network
    const bars = [
      {
        id: 'expo_bar_main_station',
        name: 'Main Bar Station',
        position: { x: 0, y: 0, z: 2.5, timestamp: Date.now() },
        capabilities: {
          canTriangulate: true,
          hasGPS: true,
          hasUWB: false,
          hasBLE: true,
          hasWiFi: true,
          canProcessOrders: true,
          isBarStation: true,
          isPhoneBeacon: false
        }
      },
      {
        id: 'expo_bar_side_station',
        name: 'Side Bar Station',
        position: { x: 25, y: 15, z: 2.5, timestamp: Date.now() },
        capabilities: {
          canTriangulate: true,
          hasGPS: true,
          hasUWB: false,
          hasBLE: true,
          hasWiFi: true,
          canProcessOrders: true,
          isBarStation: true,
          isPhoneBeacon: false
        }
      },
      {
        id: 'expo_bar_deck_station',
        name: 'Deck Bar Station',
        position: { x: -20, y: 30, z: 8.0, timestamp: Date.now() },
        capabilities: {
          canTriangulate: true,
          hasGPS: true,
          hasUWB: false,
          hasBLE: true,
          hasWiFi: true,
          canProcessOrders: true,
          isBarStation: true,
          isPhoneBeacon: false
        }
      }
    ];

    bars.forEach(bar => {
      const barNode: MeshNode = {
        id: bar.id,
        type: 'bar_station',
        position: bar.position,
        capabilities: bar.capabilities,
        lastSeen: Date.now(),
        signalStrength: -45, // Strong signal for stations
        status: 'online'
      };
      
      this.barStations.set(bar.id, barNode);
      this.knownNodes.set(bar.id, barNode);
    });
  }

  async startMeshNetwork(): Promise<void> {
    if (this._isActive) {
      console.log('Expo Go mesh network already active');
      return;
    }

    try {
      this._isActive = true;

      // Load persisted network state
      await this.loadNetworkState();

      // Start discovery and simulation
      if (this.config.enableAutoDiscovery) {
        await this.startNodeDiscovery();
      }

      this.startHeartbeat();
      this.startNetworkSimulation();

      console.log('Expo Go mesh network started');
    } catch (error) {
      this._isActive = false;
      console.error('Error starting Expo Go mesh network:', error);
      throw error;
    }
  }

  async stopMeshNetwork(): Promise<void> {
    this._isActive = false;

    // Stop all intervals
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    // Save network state
    await this.saveNetworkState();

    // Clear state
    this.knownNodes.clear();
    this.connections.clear();
    this.deliveryQueue = [];

    console.log('Expo Go mesh network stopped');
  }

  private async loadNetworkState(): Promise<void> {
    try {
      const savedNodes = await AsyncStorage.getItem('expo_mesh_nodes');
      if (savedNodes) {
        const nodes = JSON.parse(savedNodes);
        nodes.forEach((node: MeshNode) => {
          // Only load nodes that aren't too old
          if (Date.now() - node.lastSeen < this.config.maxNodeAge!) {
            this.knownNodes.set(node.id, node);
            if (node.capabilities.isBarStation) {
              this.barStations.set(node.id, node);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error loading mesh network state:', error);
    }
  }

  private async saveNetworkState(): Promise<void> {
    try {
      const nodes = Array.from(this.knownNodes.values());
      await AsyncStorage.setItem('expo_mesh_nodes', JSON.stringify(nodes));
    } catch (error) {
      console.error('Error saving mesh network state:', error);
    }
  }

  private async startNodeDiscovery(): Promise<void> {
    this.discoveryInterval = setInterval(() => {
      this.performNodeDiscovery();
      this.cleanupStaleNodes();
    }, this.config.discoveryInterval!);

    // Initial discovery
    this.performNodeDiscovery();
  }

  private performNodeDiscovery(): void {
    // Simulate discovering nearby nodes
    this.simulateNodeDiscovery();
    
    // Announce our presence
    this.announcePresence();
  }

  private simulateNodeDiscovery(): void {
    // Simulate discovering mobile nodes (other phones)
    const mobileNodeCount = Math.floor(Math.random() * 3) + 1; // 1-3 mobile nodes
    
    for (let i = 0; i < mobileNodeCount; i++) {
      const nodeId = `expo_mobile_${i}_${Math.floor(Date.now() / 10000)}`;
      
      if (!this.knownNodes.has(nodeId)) {
        const distance = Math.random() * 50 + 5; // 5-55 meters away
        const angle = Math.random() * 2 * Math.PI;
        
        const mobileNode: MeshNode = {
          id: nodeId,
          type: 'mobile',
          position: {
            x: this.localNode.position.x + Math.cos(angle) * distance,
            y: this.localNode.position.y + Math.sin(angle) * distance,
            z: this.localNode.position.z + (Math.random() - 0.5) * 2,
            timestamp: Date.now()
          },
          capabilities: {
            canTriangulate: true,
            hasGPS: true,
            hasUWB: false,
            hasBLE: false,
            hasWiFi: true,
            canProcessOrders: false,
            isBarStation: false,
            isPhoneBeacon: true
          },
          lastSeen: Date.now(),
          signalStrength: -60 - Math.random() * 20, // -60 to -80 dBm
          batteryLevel: Math.floor(Math.random() * 40) + 60, // 60-100%
          status: 'online'
        };

        this.knownNodes.set(nodeId, mobileNode);
        this.config.onNodeDiscovered?.(mobileNode);
        
        console.log(`Discovered mobile node: ${nodeId} at distance ${distance.toFixed(1)}m`);
      }
    }
  }

  private announcePresence(): void {
    // Update our last seen time
    this.localNode.lastSeen = Date.now();
    
    // In a real implementation, this would broadcast our presence
    console.log(`Announcing presence: ${this.localNode.id}`);
  }

  private cleanupStaleNodes(): void {
    const cutoffTime = Date.now() - this.config.maxNodeAge!;
    
    for (const [nodeId, node] of this.knownNodes) {
      if (node.lastSeen < cutoffTime && !node.capabilities.isBarStation) {
        this.knownNodes.delete(nodeId);
        this.connections.delete(nodeId);
        this.config.onNodeLost?.(nodeId);
        console.log(`Node expired: ${nodeId}`);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 10000); // Every 10 seconds
  }

  private sendHeartbeat(): void {
    // Update local node status
    this.localNode.lastSeen = Date.now();
    this.localNode.batteryLevel = Math.max(20, (this.localNode.batteryLevel || 85) - Math.random() * 2);
    
    // Simulate network health
    this.updateNetworkHealth();
  }

  private updateNetworkHealth(): void {
    // Simulate varying signal strengths and connectivity
    for (const [nodeId, node] of this.knownNodes) {
      if (nodeId !== this.localNode.id) {
        // Simulate signal strength variation
        const baseSignal = node.capabilities.isBarStation ? -45 : -65;
        const variation = (Math.random() - 0.5) * 10;
        node.signalStrength = baseSignal + variation;
        
        // Update connection info
        this.connections.set(nodeId, {
          fromNodeId: this.localNode.id,
          toNodeId: nodeId,
          signalStrength: node.signalStrength,
          latency: Math.random() * 100 + 10, // 10-110ms
          bandwidth: Math.random() * 50 + 10, // 10-60 Mbps
          reliability: Math.max(0.5, 1 - Math.abs(node.signalStrength) / 100),
          lastUpdate: Date.now()
        });
      }
    }
  }

  private startNetworkSimulation(): void {
    // Simulate realistic network behavior
    this.simulationInterval = setInterval(() => {
      // Simulate position updates from other nodes
      this.simulatePositionUpdates();
      
      // Simulate triangulation requests
      if (Math.random() < 0.1) { // 10% chance per interval
        this.simulateTriangulationRequest();
      }
    }, 5000);
  }

  private simulatePositionUpdates(): void {
    // Simulate other mobile nodes moving around
    for (const [nodeId, node] of this.knownNodes) {
      if (node.type === 'mobile' && nodeId !== this.localNode.id) {
        // Small random movement
        node.position.x += (Math.random() - 0.5) * 2;
        node.position.y += (Math.random() - 0.5) * 2;
        node.position.timestamp = Date.now();
        node.lastSeen = Date.now();
      }
    }
  }

  private simulateTriangulationRequest(): void {
    const mobileNodes = Array.from(this.knownNodes.values()).filter(n => n.type === 'mobile');
    if (mobileNodes.length > 0) {
      const requester = mobileNodes[Math.floor(Math.random() * mobileNodes.length)];
      
      const request: TriangulationRequest = {
        id: `tri_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        requesterId: requester.id,
        targetPosition: requester.position,
        timestamp: Date.now(),
        priority: 'normal',
        requiredAccuracy: 2.0
      };

      this.config.onTriangulationRequest?.(request);
    }
  }

  updateLocalPosition(position: Point3D, geoPosition?: GeoPoint3D): void {
    this.localNode.position = { ...position, timestamp: Date.now() };
    this.localNode.geoPosition = geoPosition;
    this.localNode.lastSeen = Date.now();
    
    console.log(`Local position updated: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
  }

  optimizeDeliveryRoute(customerId: string, customerPosition: Point3D): DeliveryOptimization {
    const nearestBars = Array.from(this.barStations.values())
      .map(bar => {
        const distance = this.calculateDistance3D(customerPosition, bar.position);
        const estimatedDeliveryTime = this.estimateDeliveryTime(distance);
        
        return {
          barId: bar.id,
          position: bar.position,
          distance,
          estimatedDeliveryTime,
          staffAvailable: true, // Simplified for Expo Go
          currentLoad: Math.floor(Math.random() * 5) // Random load 0-4
        };
      })
      .sort((a, b) => a.distance - b.distance);

    const recommendedBar = nearestBars[0];

    const optimization: DeliveryOptimization = {
      customerId,
      customerPosition,
      nearestBars,
      recommendedBar: recommendedBar.barId,
      estimatedTotalTime: recommendedBar.estimatedDeliveryTime + 120 // Add 2min prep time
    };

    this.config.onDeliveryOptimization?.(optimization);
    return optimization;
  }

  findNearestBarStation(position: Point3D, maxDistance: number = 50): MeshNode | null {
    let nearestBar: MeshNode | null = null;
    let minDistance = maxDistance;

    for (const bar of this.barStations.values()) {
      const distance = this.calculateDistance3D(position, bar.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestBar = bar;
      }
    }

    return nearestBar;
  }

  private calculateDistance3D(point1: Point3D, point2: Point3D): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private estimateDeliveryTime(distance: number): number {
    // Walking speed ~1.4 m/s, plus some overhead
    const walkingTime = distance / 1.4;
    const overhead = Math.random() * 30 + 15; // 15-45 seconds overhead
    return Math.ceil(walkingTime + overhead);
  }

  // Public API
  getKnownNodes(): MeshNode[] {
    return Array.from(this.knownNodes.values());
  }

  getBarStations(): MeshNode[] {
    return Array.from(this.barStations.values());
  }

  getConnections(): MeshConnection[] {
    return Array.from(this.connections.values());
  }

  getLocalNode(): MeshNode {
    return { ...this.localNode };
  }

  getNetworkHealth(): {
    totalNodes: number;
    onlineNodes: number;
    barStations: number;
    averageSignalStrength: number;
    networkCoverage: number;
  } {
    const nodes = Array.from(this.knownNodes.values());
    const onlineNodes = nodes.filter(n => n.status === 'online');
    const barStations = nodes.filter(n => n.capabilities.isBarStation);
    const avgSignal = nodes.reduce((sum, n) => sum + n.signalStrength, 0) / nodes.length;
    
    return {
      totalNodes: nodes.length,
      onlineNodes: onlineNodes.length,
      barStations: barStations.length,
      averageSignalStrength: avgSignal,
      networkCoverage: Math.min(1, onlineNodes.length / 5) // Assume 5 nodes = full coverage
    };
  }

  isActive(): boolean {
    return this._isActive;
  }
}

export default ExpoGoMeshService;
