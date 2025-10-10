/**
 * IndoorAtlas Configuration
 * 
 * Credentials are loaded from .env file for security
 * See .env.example for setup instructions
 */

export const INDOORATLAS_CONFIG = {
  // API credentials loaded from environment variables
  API_KEY: process.env.EXPO_PUBLIC_INDOORATLAS_API_KEY || '',
  API_SECRET: process.env.EXPO_PUBLIC_INDOORATLAS_API_SECRET || '',
  
  // Enable/disable IndoorAtlas (fallback to GPS if disabled)
  ENABLED: process.env.EXPO_PUBLIC_INDOORATLAS_ENABLED === 'true',
  
  // Update interval in milliseconds
  UPDATE_INTERVAL: 1000, // 1 second
  
  // Positioning accuracy mode
  // 'HIGH' = more accurate but higher battery usage
  // 'NORMAL' = balanced
  // 'LOW' = lower accuracy but saves battery
  ACCURACY_MODE: 'HIGH' as 'HIGH' | 'NORMAL' | 'LOW',
};

/**
 * Check if IndoorAtlas is properly configured
 */
export function isIndoorAtlasConfigured(): boolean {
  return (
    INDOORATLAS_CONFIG.ENABLED &&
    INDOORATLAS_CONFIG.API_KEY !== '' &&
    INDOORATLAS_CONFIG.API_KEY !== 'your_api_key_here' &&
    INDOORATLAS_CONFIG.API_SECRET !== '' &&
    INDOORATLAS_CONFIG.API_SECRET !== 'your_api_secret_here'
  );
}


