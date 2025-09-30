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
// Comprehensive global coastline database for cruise ship detection
const MAJOR_COASTLINES = [
  // === NORTH AMERICA ===
  // US East Coast
  { name: 'Florida Coast', lat: 27.0, lng: -80.0, radius: 50000 },
  { name: 'Georgia Coast', lat: 32.0, lng: -81.0, radius: 30000 },
  { name: 'Carolina Coast', lat: 35.0, lng: -76.0, radius: 40000 },
  { name: 'Virginia Coast', lat: 37.0, lng: -76.0, radius: 30000 },
  { name: 'New York Coast', lat: 40.7, lng: -74.0, radius: 25000 },
  { name: 'Maine Coast', lat: 44.3, lng: -68.2, radius: 20000 },
  
  // US West Coast
  { name: 'Southern California', lat: 33.0, lng: -118.0, radius: 60000 },
  { name: 'Central California', lat: 36.0, lng: -121.5, radius: 50000 },
  { name: 'Northern California', lat: 38.0, lng: -123.0, radius: 40000 },
  { name: 'Oregon Coast', lat: 44.0, lng: -124.0, radius: 30000 },
  { name: 'Washington Coast', lat: 47.6, lng: -124.0, radius: 25000 },
  
  // US Gulf Coast
  { name: 'Texas Coast', lat: 29.0, lng: -94.0, radius: 40000 },
  { name: 'Louisiana Coast', lat: 29.5, lng: -90.0, radius: 30000 },
  { name: 'Mississippi Coast', lat: 30.4, lng: -89.0, radius: 15000 },
  { name: 'Alabama Coast', lat: 30.2, lng: -88.0, radius: 20000 },
  { name: 'Florida Panhandle', lat: 30.4, lng: -86.5, radius: 25000 },
  
  // Canada East Coast
  { name: 'Nova Scotia', lat: 44.7, lng: -63.6, radius: 35000 },
  { name: 'New Brunswick', lat: 45.3, lng: -66.1, radius: 25000 },
  { name: 'Newfoundland', lat: 47.6, lng: -52.7, radius: 40000 },
  
  // Canada West Coast
  { name: 'British Columbia', lat: 49.3, lng: -123.1, radius: 50000 },
  { name: 'Vancouver Island', lat: 49.7, lng: -125.3, radius: 30000 },
  
  // === CARIBBEAN & CENTRAL AMERICA ===
  { name: 'Bahamas', lat: 24.25, lng: -76.0, radius: 15000 },
  { name: 'Jamaica', lat: 18.1, lng: -77.3, radius: 10000 },
  { name: 'Puerto Rico', lat: 18.2, lng: -66.5, radius: 8000 },
  { name: 'Dominican Republic', lat: 18.7, lng: -70.2, radius: 12000 },
  { name: 'Cuba', lat: 21.5, lng: -80.0, radius: 20000 },
  { name: 'Barbados', lat: 13.2, lng: -59.5, radius: 5000 },
  { name: 'St. Lucia', lat: 14.0, lng: -61.0, radius: 4000 },
  { name: 'Aruba', lat: 12.5, lng: -70.0, radius: 3000 },
  { name: 'Cozumel Mexico', lat: 20.5, lng: -86.9, radius: 8000 },
  { name: 'Belize', lat: 17.3, lng: -88.2, radius: 6000 },
  { name: 'Costa Rica', lat: 9.9, lng: -84.1, radius: 15000 },
  { name: 'Panama', lat: 8.5, lng: -80.8, radius: 12000 },
  
  // === SOUTH AMERICA ===
  { name: 'Colombia Coast', lat: 10.4, lng: -75.5, radius: 25000 },
  { name: 'Venezuela Coast', lat: 10.5, lng: -66.9, radius: 20000 },
  { name: 'Brazil Northeast', lat: -8.0, lng: -35.0, radius: 40000 },
  { name: 'Brazil Southeast', lat: -23.0, lng: -43.2, radius: 35000 },
  { name: 'Argentina Coast', lat: -34.6, lng: -58.4, radius: 30000 },
  { name: 'Chile Coast', lat: -33.4, lng: -70.6, radius: 50000 },
  { name: 'Peru Coast', lat: -12.0, lng: -77.0, radius: 25000 },
  { name: 'Ecuador Coast', lat: -2.2, lng: -79.9, radius: 15000 },
  
  // === EUROPE ===
  // Mediterranean
  { name: 'Spain Mediterranean', lat: 39.5, lng: 2.6, radius: 40000 },
  { name: 'France Riviera', lat: 43.7, lng: 7.3, radius: 25000 },
  { name: 'Italy West Coast', lat: 41.9, lng: 12.5, radius: 35000 },
  { name: 'Italy East Coast', lat: 40.6, lng: 17.9, radius: 30000 },
  { name: 'Greece Mainland', lat: 38.0, lng: 23.7, radius: 25000 },
  { name: 'Greek Islands', lat: 37.0, lng: 25.0, radius: 20000 },
  { name: 'Turkey Coast', lat: 36.9, lng: 30.7, radius: 30000 },
  { name: 'Croatia Coast', lat: 43.5, lng: 16.4, radius: 25000 },
  
  // Atlantic Europe
  { name: 'Portugal Coast', lat: 38.7, lng: -9.1, radius: 30000 },
  { name: 'Spain Atlantic', lat: 43.4, lng: -8.4, radius: 35000 },
  { name: 'France Atlantic', lat: 46.2, lng: -1.2, radius: 40000 },
  { name: 'UK South Coast', lat: 50.8, lng: -1.1, radius: 35000 },
  { name: 'Ireland Coast', lat: 53.3, lng: -6.3, radius: 30000 },
  
  // Baltic & North Sea
  { name: 'Norway Coast', lat: 59.9, lng: 10.8, radius: 50000 },
  { name: 'Sweden Coast', lat: 59.3, lng: 18.1, radius: 40000 },
  { name: 'Denmark Coast', lat: 55.7, lng: 12.6, radius: 25000 },
  { name: 'Germany Coast', lat: 53.6, lng: 10.0, radius: 20000 },
  { name: 'Netherlands Coast', lat: 52.4, lng: 4.9, radius: 15000 },
  { name: 'Finland Coast', lat: 60.2, lng: 25.0, radius: 35000 },
  { name: 'Estonia Coast', lat: 59.4, lng: 24.8, radius: 15000 },
  { name: 'Russia Baltic', lat: 59.9, lng: 30.3, radius: 25000 },
  
  // === ASIA PACIFIC ===
  // Japan
  { name: 'Japan East Coast', lat: 35.7, lng: 139.7, radius: 60000 },
  { name: 'Japan West Coast', lat: 34.7, lng: 135.5, radius: 50000 },
  { name: 'Japan South', lat: 31.6, lng: 131.4, radius: 40000 },
  
  // China & Korea
  { name: 'China East Coast', lat: 31.2, lng: 121.5, radius: 70000 },
  { name: 'China South Coast', lat: 22.3, lng: 114.2, radius: 50000 },
  { name: 'South Korea', lat: 35.2, lng: 129.1, radius: 35000 },
  { name: 'North Korea', lat: 39.0, lng: 125.8, radius: 20000 },
  
  // Southeast Asia
  { name: 'Philippines North', lat: 14.6, lng: 121.0, radius: 40000 },
  { name: 'Philippines South', lat: 7.1, lng: 125.6, radius: 35000 },
  { name: 'Vietnam Coast', lat: 10.8, lng: 106.7, radius: 45000 },
  { name: 'Thailand Coast', lat: 7.9, lng: 98.4, radius: 25000 },
  { name: 'Malaysia West', lat: 3.1, lng: 101.7, radius: 30000 },
  { name: 'Malaysia East', lat: 6.0, lng: 116.1, radius: 25000 },
  { name: 'Singapore', lat: 1.3, lng: 103.8, radius: 8000 },
  { name: 'Indonesia West', lat: -6.2, lng: 106.8, radius: 50000 },
  { name: 'Indonesia East', lat: -8.3, lng: 115.1, radius: 40000 },
  
  // India & Indian Ocean
  { name: 'India West Coast', lat: 19.1, lng: 72.9, radius: 60000 },
  { name: 'India East Coast', lat: 13.1, lng: 80.3, radius: 50000 },
  { name: 'Sri Lanka', lat: 6.9, lng: 79.9, radius: 15000 },
  { name: 'Maldives', lat: 3.2, lng: 73.2, radius: 8000 },
  
  // === OCEANIA ===
  { name: 'Australia East', lat: -33.9, lng: 151.2, radius: 80000 },
  { name: 'Australia West', lat: -31.9, lng: 115.9, radius: 60000 },
  { name: 'Australia North', lat: -12.5, lng: 130.8, radius: 50000 },
  { name: 'New Zealand North', lat: -36.8, lng: 174.8, radius: 40000 },
  { name: 'New Zealand South', lat: -43.5, lng: 172.6, radius: 35000 },
  { name: 'Fiji', lat: -18.1, lng: 178.4, radius: 10000 },
  { name: 'Tahiti', lat: -17.5, lng: -149.6, radius: 8000 },
  { name: 'Hawaii', lat: 21.3, lng: -157.8, radius: 15000 },
  
  // === MIDDLE EAST & AFRICA ===
  { name: 'UAE Coast', lat: 25.3, lng: 55.3, radius: 20000 },
  { name: 'Oman Coast', lat: 23.6, lng: 58.5, radius: 25000 },
  { name: 'Egypt Red Sea', lat: 27.3, lng: 33.8, radius: 30000 },
  { name: 'Israel Coast', lat: 32.1, lng: 34.8, radius: 15000 },
  { name: 'Morocco Coast', lat: 33.6, lng: -7.6, radius: 25000 },
  { name: 'South Africa Cape', lat: -33.9, lng: 18.4, radius: 40000 },
  { name: 'South Africa East', lat: -29.9, lng: 31.0, radius: 35000 },
  
  // === ARCTIC & NORTHERN ROUTES ===
  { name: 'Iceland', lat: 64.1, lng: -21.9, radius: 20000 },
  { name: 'Greenland', lat: 64.2, lng: -51.7, radius: 50000 },
  { name: 'Alaska South', lat: 58.3, lng: -134.4, radius: 60000 },
  { name: 'Alaska West', lat: 61.2, lng: -149.9, radius: 40000 },
  { name: 'Russia Arctic', lat: 68.0, lng: 33.0, radius: 80000 }
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
