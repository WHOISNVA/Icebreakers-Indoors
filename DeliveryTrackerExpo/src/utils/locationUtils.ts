/**
 * Location utility functions for formatting and calculations
 */

/**
 * Format location coordinates to a readable string
 */
export function formatLocation(latitude: number, longitude: number, precision: number = 6): string {
  return `${latitude.toFixed(precision)}, ${longitude.toFixed(precision)}`;
}

/**
 * Format distance in meters to a human-readable string
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(2)}km`;
  }
}

/**
 * Format accuracy in meters to a human-readable string
 */
export function formatAccuracy(accuracy: number): string {
  if (accuracy < 1) {
    return `±${Math.round(accuracy * 100)}cm`;
  } else if (accuracy < 1000) {
    return `±${Math.round(accuracy)}m`;
  } else {
    return `±${(accuracy / 1000).toFixed(2)}km`;
  }
}

/**
 * Format speed in m/s to km/h
 */
export function formatSpeed(speedMs: number): string {
  const speedKmh = speedMs * 3.6;
  return `${speedKmh.toFixed(1)} km/h`;
}

/**
 * Format heading/bearing in degrees to cardinal direction
 */
export function formatHeading(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return `${directions[index]} (${Math.round(degrees)}°)`;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate bearing between two coordinates
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360; // Bearing in degrees
}

/**
 * Check if a point is within a circle (for zone detection)
 */
export function isWithinRadius(
  latitude: number,
  longitude: number,
  centerLat: number,
  centerLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(latitude, longitude, centerLat, centerLon);
  return distance <= radiusMeters;
}

/**
 * Calculate speed between two location points
 */
export function calculateSpeed(
  lat1: number,
  lon1: number,
  timestamp1: number,
  lat2: number,
  lon2: number,
  timestamp2: number
): number {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  const timeDiff = (timestamp2 - timestamp1) / 1000; // Convert to seconds

  if (timeDiff <= 0) {
    return 0;
  }

  return distance / timeDiff; // Speed in m/s
}

/**
 * Format timestamp to time string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

/**
 * Format timestamp to date and time string
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Calculate estimated time of arrival (ETA)
 */
export function calculateETA(
  currentLat: number,
  currentLon: number,
  destinationLat: number,
  destinationLon: number,
  averageSpeedMs: number
): number {
  const distance = calculateDistance(currentLat, currentLon, destinationLat, destinationLon);
  
  if (averageSpeedMs <= 0) {
    return Infinity;
  }

  return distance / averageSpeedMs; // Time in seconds
}

/**
 * Format ETA in seconds to human-readable string
 */
export function formatETA(seconds: number): string {
  if (seconds === Infinity) {
    return 'Unknown';
  }

  const minutes = Math.round(seconds / 60);
  
  if (minutes < 1) {
    return 'Less than 1 min';
  } else if (minutes === 1) {
    return '1 min';
  } else if (minutes < 60) {
    return `${minutes} mins`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}

/**
 * Check if location accuracy is acceptable
 */
export function isAccuracyAcceptable(accuracy: number, threshold: number = 25): boolean {
  return accuracy <= threshold;
}

/**
 * Get accuracy quality description
 */
export function getAccuracyQuality(accuracy: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (accuracy <= 5) return 'excellent';
  if (accuracy <= 15) return 'good';
  if (accuracy <= 50) return 'fair';
  return 'poor';
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Calculate angle difference (shortest path)
 */
export function angleDifference(angle1: number, angle2: number): number {
  const diff = Math.abs(normalizeAngle(angle1) - normalizeAngle(angle2));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Building base altitude storage
 * Uses a smart averaging approach to determine ground floor
 */
let buildingAltitudeSamples: number[] = [];
let buildingBaseAltitude: number | null = null;
let floorOffset: number = 0; // Manual floor offset adjustment

/**
 * Set the building's base altitude (ground floor reference)
 * Uses smart averaging: assumes the lowest altitude seen is ground floor
 */
export function setBuildingBaseAltitude(altitude: number): void {
  // Collect samples from first few orders
  buildingAltitudeSamples.push(altitude);
  
  // Use the LOWEST altitude as ground floor (makes sense since ground = lowest point)
  const lowestAltitude = Math.min(...buildingAltitudeSamples);
  buildingBaseAltitude = lowestAltitude;
  
  console.log(`🏢 Building base altitude updated: ${lowestAltitude.toFixed(1)}m (from ${buildingAltitudeSamples.length} samples)`);
}

/**
 * Set manual floor offset (e.g., if first order was on 3rd floor, set offset to -3)
 */
export function setFloorOffset(offset: number): void {
  floorOffset = offset;
  console.log(`🏢 Floor offset set to ${offset} floors`);
}

/**
 * Get the current floor offset
 */
export function getFloorOffset(): number {
  return floorOffset;
}

/**
 * Reset the building base altitude (for testing or changing venues)
 */
export function resetBuildingBaseAltitude(): void {
  buildingBaseAltitude = null;
  buildingAltitudeSamples = [];
  floorOffset = 0;
  console.log('🏢 Building base altitude and floor offset reset');
}

/**
 * Get the current building base altitude
 */
export function getBuildingBaseAltitude(): number | null {
  return buildingBaseAltitude;
}

/**
 * Estimate floor number from altitude
 * Assumes ~3 meters (10 feet) per floor
 * Ground floor = 0, First floor = 1, etc.
 * 
 * Uses the building's base altitude as reference if available
 */
export function estimateFloor(altitude: number, groundAltitude?: number): number {
  const METERS_PER_FLOOR = 4.0; // Average floor height in commercial buildings (more accurate)
  
  // Use provided groundAltitude, or fall back to stored building base
  const baseAltitude = groundAltitude ?? buildingBaseAltitude;
  
  // If no base altitude, can't reliably estimate floor
  if (baseAltitude === null || baseAltitude === undefined) {
    console.log('🏢 No base altitude yet - returning floor 0');
    return 0;
  }
  
  const relativeAltitude = altitude - baseAltitude;
  
  // Round to nearest floor, but with a small threshold to prevent jitter
  // (e.g., 3.7m = floor 1, 4.3m = floor 1, but 4.5m = floor 1, 5.0m = floor 1, 6.0m = floor 2)
  let calculatedFloor = Math.round(relativeAltitude / METERS_PER_FLOOR);
  
  // Apply manual floor offset (e.g., if calibrated on 3rd floor, offset = +3)
  const floor = calculatedFloor + floorOffset;
  
  // Clamp to reasonable range (0-100 floors)
  const finalFloor = Math.max(0, Math.min(100, floor));
  
  console.log(`🏢 Floor calculation: altitude=${altitude.toFixed(1)}m, base=${baseAltitude.toFixed(1)}m, relative=${relativeAltitude.toFixed(1)}m, floor=${finalFloor}`);
  
  return finalFloor;
}

/**
 * Format floor number for display
 */
export function formatFloor(floor: number): string {
  if (floor === 0) return 'Ground Floor';
  if (floor === 1) return '1st Floor';
  if (floor === 2) return '2nd Floor';
  if (floor === 3) return '3rd Floor';
  return `${floor}th Floor`;
}

/**
 * Calculate vertical distance between two altitudes
 */
export function calculateVerticalDistance(altitude1: number, altitude2: number): number {
  return Math.abs(altitude2 - altitude1);
}

/**
 * Calculate 3D distance (including altitude)
 */
export function calculate3DDistance(
  lat1: number,
  lon1: number,
  alt1: number,
  lat2: number,
  lon2: number,
  alt2: number
): number {
  // Calculate horizontal distance
  const horizontalDistance = calculateDistance(lat1, lon1, lat2, lon2);
  
  // Calculate vertical distance
  const verticalDistance = calculateVerticalDistance(alt1, alt2);
  
  // Use Pythagorean theorem for 3D distance
  return Math.sqrt(horizontalDistance ** 2 + verticalDistance ** 2);
}

