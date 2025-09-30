import * as Location from 'expo-location';

const CRUISE_SHIP_AREAS = [
  { name: 'Miami Port', lat: 25.7612, lng: -80.1923, radius: 2000 },
  { name: 'Port Canaveral', lat: 28.4108, lng: -80.6036, radius: 2000 },
  { name: 'Galveston Port', lat: 29.3013, lng: -94.7977, radius: 2000 },
  { name: 'Seattle Port', lat: 47.6062, lng: -122.3321, radius: 2000 },
  { name: 'Los Angeles Port', lat: 33.7701, lng: -118.1937, radius: 2000 },
  { name: 'New York Port', lat: 40.7589, lng: -73.9851, radius: 2000 }
];

// Major land masses for distance calculation (at-sea detection)
const MAJOR_COASTLINES = [
  // US East Coast
  { name: 'Florida Coast', lat: 27.0, lng: -80.0, radius: 50000 },
  { name: 'Georgia Coast', lat: 32.0, lng: -81.0, radius: 30000 },
  { name: 'Carolina Coast', lat: 35.0, lng: -76.0, radius: 40000 },
  { name: 'Virginia Coast', lat: 37.0, lng: -76.0, radius: 30000 },
  { name: 'New York Coast', lat: 40.7, lng: -74.0, radius: 25000 },
  
  // US West Coast
  { name: 'California Coast', lat: 34.0, lng: -119.0, radius: 60000 },
  { name: 'Oregon Coast', lat: 44.0, lng: -124.0, radius: 30000 },
  { name: 'Washington Coast', lat: 47.6, lng: -124.0, radius: 25000 },
  
  // US Gulf Coast
  { name: 'Texas Coast', lat: 29.0, lng: -94.0, radius: 40000 },
  { name: 'Louisiana Coast', lat: 29.5, lng: -90.0, radius: 30000 },
  { name: 'Alabama Coast', lat: 30.2, lng: -88.0, radius: 20000 },
  
  // Caribbean
  { name: 'Bahamas', lat: 24.25, lng: -76.0, radius: 15000 },
  { name: 'Jamaica', lat: 18.1, lng: -77.3, radius: 10000 },
  { name: 'Puerto Rico', lat: 18.2, lng: -66.5, radius: 8000 },
  { name: 'Dominican Republic', lat: 18.7, lng: -70.2, radius: 12000 },
  { name: 'Cuba', lat: 21.5, lng: -80.0, radius: 20000 }
];

export interface ShipDetectionResult {
  isOnShip: boolean;
  isAtSea: boolean;
  isNearPort: boolean;
  confidence: number;
  distanceFromLand: number;
  seaState: 'calm' | 'moderate' | 'rough';
  shipMotionDetected: boolean;
  recommendedShipMode: boolean;
  detectionReason: string;
}

export class ShipDetectionService {
  static async detectShipEnvironment(): Promise<ShipDetectionResult> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return this.createDefaultResult('Location permission denied');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation
      });

      const { latitude, longitude, altitude, accuracy } = location.coords;

      // Check proximity to cruise ports
      const portResult = this.checkPortProximity(latitude, longitude);
      
      // Check if at sea (distance from land)
      const seaResult = this.checkAtSeaStatus(latitude, longitude, altitude, accuracy);
      
      // Determine overall ship detection
      const isOnShip = portResult.isNearPort || seaResult.isAtSea || seaResult.shipMotionDetected;
      
      const result: ShipDetectionResult = {
        isOnShip,
        isAtSea: seaResult.isAtSea,
        isNearPort: portResult.isNearPort,
        confidence: this.calculateConfidence(portResult, seaResult, accuracy),
        distanceFromLand: seaResult.distanceFromLand,
        seaState: seaResult.seaState,
        shipMotionDetected: seaResult.shipMotionDetected,
        recommendedShipMode: isOnShip,
        detectionReason: this.getDetectionReason(portResult, seaResult)
      };

      console.log(`Ship Detection Result:`, result);
      return result;

    } catch (error) {
      console.error('Error detecting ship environment:', error);
      return this.createDefaultResult('Detection error');
    }
  }

  private static checkPortProximity(lat: number, lng: number) {
    let isNearPort = false;
    let nearestPort = '';
    let minDistance = Infinity;

    for (const area of CRUISE_SHIP_AREAS) {
      const distance = this.calculateDistance(lat, lng, area.lat, area.lng);
      if (distance <= area.radius) {
        isNearPort = true;
        if (distance < minDistance) {
          minDistance = distance;
          nearestPort = area.name;
        }
      }
    }

    return { isNearPort, nearestPort, portDistance: minDistance };
  }

  private static checkAtSeaStatus(lat: number, lng: number, altitude: number | null, accuracy: number | null) {
    // Calculate distance from nearest land
    const distanceFromLand = this.calculateDistanceFromLand(lat, lng);
    
    // At sea if more than 5km from any major coastline
    const isAtSea = distanceFromLand > 5000;
    
    // Determine sea state based on GPS accuracy and altitude
    const seaState = this.determineSeaState(accuracy, altitude);
    
    // Detect ship motion patterns (elevated position + GPS characteristics)
    const shipMotionDetected = this.detectShipMotion(altitude, accuracy, distanceFromLand);

    return {
      isAtSea,
      distanceFromLand,
      seaState,
      shipMotionDetected
    };
  }

  private static calculateDistanceFromLand(lat: number, lng: number): number {
    let minDistance = Infinity;

    for (const coast of MAJOR_COASTLINES) {
      const distance = this.calculateDistance(lat, lng, coast.lat, coast.lng);
      // Adjust for coastline radius (approximate land mass size)
      const adjustedDistance = Math.max(0, distance - coast.radius);
      minDistance = Math.min(minDistance, adjustedDistance);
    }

    return minDistance;
  }

  private static determineSeaState(accuracy: number | null, altitude: number | null): 'calm' | 'moderate' | 'rough' {
    if (!accuracy) return 'moderate';
    
    // GPS accuracy degrades in rough seas due to ship motion
    if (accuracy < 5) return 'calm';
    if (accuracy < 15) return 'moderate';
    return 'rough';
  }

  private static detectShipMotion(altitude: number | null, accuracy: number | null, distanceFromLand: number): boolean {
    // Ship motion indicators:
    // 1. Elevated position (ship decks are 10-80m above sea level)
    // 2. Varying GPS accuracy (due to ship movement)
    // 3. Distance from land
    
    const elevatedPosition = altitude && altitude > 8 && altitude < 100;
    const maritimeGPS = accuracy && accuracy > 3; // Ships have less stable GPS
    const openWater = distanceFromLand > 1000;
    
    return !!(elevatedPosition && (maritimeGPS || openWater));
  }

  private static calculateConfidence(portResult: any, seaResult: any, accuracy: number | null): number {
    let confidence = 0;

    // Port proximity (high confidence)
    if (portResult.isNearPort) confidence += 90;
    
    // At sea detection (medium-high confidence)
    else if (seaResult.isAtSea) confidence += 75;
    
    // Ship motion detected (medium confidence)
    else if (seaResult.shipMotionDetected) confidence += 60;

    // GPS accuracy factor
    if (accuracy) {
      if (accuracy < 10) confidence += 10;
      else if (accuracy > 20) confidence -= 10;
    }

    // Sea state factor
    if (seaResult.seaState === 'rough') confidence += 15;
    else if (seaResult.seaState === 'calm') confidence += 5;

    return Math.max(0, Math.min(100, confidence));
  }

  private static getDetectionReason(portResult: any, seaResult: any): string {
    if (portResult.isNearPort) {
      return `Near ${portResult.nearestPort}`;
    }
    if (seaResult.isAtSea) {
      return `At sea (${(seaResult.distanceFromLand / 1000).toFixed(1)}km from land)`;
    }
    if (seaResult.shipMotionDetected) {
      return `Ship motion detected`;
    }
    return 'No ship environment detected';
  }

  private static createDefaultResult(reason: string): ShipDetectionResult {
    return {
      isOnShip: false,
      isAtSea: false,
      isNearPort: false,
      confidence: 0,
      distanceFromLand: 0,
      seaState: 'calm',
      shipMotionDetected: false,
      recommendedShipMode: false,
      detectionReason: reason
    };
  }

  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Continuous monitoring for at-sea detection
  static startContinuousDetection(
    callback: (result: ShipDetectionResult) => void,
    intervalMs: number = 30000
  ): NodeJS.Timeout {
    const interval = setInterval(async () => {
      const result = await this.detectShipEnvironment();
      callback(result);
    }, intervalMs);

    return interval;
  }

  static stopContinuousDetection(interval: NodeJS.Timeout): void {
    clearInterval(interval);
  }
}

export default ShipDetectionService;
