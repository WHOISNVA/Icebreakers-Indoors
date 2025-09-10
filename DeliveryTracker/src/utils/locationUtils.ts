import { LocationData } from '../types';

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param lat1 First latitude
 * @param lon1 First longitude
 * @param lat2 Second latitude
 * @param lon2 Second longitude
 * @returns Distance in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
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
};

/**
 * Calculate the bearing between two coordinates
 * @param lat1 First latitude
 * @param lon1 First longitude
 * @param lat2 Second latitude
 * @param lon2 Second longitude
 * @returns Bearing in degrees
 */
export const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

/**
 * Format location data for display
 * @param location Location data object
 * @returns Formatted location string
 */
export const formatLocation = (location: LocationData): string => {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
};

/**
 * Format distance for display
 * @param distance Distance in meters
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  } else {
    return `${(distance / 1000).toFixed(1)}km`;
  }
};

/**
 * Format speed for display
 * @param speed Speed in m/s
 * @returns Formatted speed string
 */
export const formatSpeed = (speed: number): string => {
  const kmh = speed * 3.6;
  return `${kmh.toFixed(1)} km/h`;
};

/**
 * Check if location is valid
 * @param location Location data object
 * @returns True if location is valid
 */
export const isValidLocation = (location: LocationData | null): boolean => {
  if (!location) return false;
  
  return (
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    location.accuracy > 0 &&
    location.timestamp > 0
  );
};

/**
 * Calculate the center point of multiple locations
 * @param locations Array of location data
 * @returns Center coordinates
 */
export const calculateCenter = (locations: LocationData[]): { latitude: number; longitude: number } => {
  if (locations.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  let totalLat = 0;
  let totalLng = 0;

  locations.forEach(location => {
    totalLat += location.latitude;
    totalLng += location.longitude;
  });

  return {
    latitude: totalLat / locations.length,
    longitude: totalLng / locations.length,
  };
};

