// Google Maps Configuration
// Replace 'YOUR_GOOGLE_MAPS_API_KEY' with your actual Google Maps API key

export const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

// Map configuration constants
export const MAP_CONFIG = {
  DEFAULT_LATITUDE: 37.78825,
  DEFAULT_LONGITUDE: -122.4324,
  LATITUDE_DELTA: 0.01,
  LONGITUDE_DELTA: 0.01,
  ZOOM_LEVEL: 15,
};

// Location tracking configuration
export const LOCATION_CONFIG = {
  ENABLE_HIGH_ACCURACY: true,
  TIMEOUT: 15000,
  MAXIMUM_AGE: 10000,
  DISTANCE_FILTER: 10, // meters
  SHOW_LOCATION_DIALOG: true,
  FORCE_REQUEST_LOCATION: true,
  FORCE_LOCATION_MANAGER: false,
  FALLBACK_TO_GOOGLE_PLAY_SERVICES: true,
};

