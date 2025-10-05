/**
 * IndoorAtlas Configuration
 * 
 * Setup Instructions:
 * 1. Create account at https://app.indooratlas.com
 * 2. Create a new venue/building
 * 3. Map your venue using IndoorAtlas MapCreator app
 * 4. Get your API Key and Secret from the dashboard
 * 5. Replace the placeholder values below
 */

export const INDOORATLAS_CONFIG = {
  // Replace with your IndoorAtlas API credentials
  API_KEY: 'YOUR_INDOORATLAS_API_KEY',
  API_SECRET: 'YOUR_INDOORATLAS_API_SECRET',
  
  // Enable/disable IndoorAtlas (fallback to GPS if disabled)
  ENABLED: false, // Set to true after you've set up your venue
  
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
    INDOORATLAS_CONFIG.API_KEY !== 'YOUR_INDOORATLAS_API_KEY' &&
    INDOORATLAS_CONFIG.API_SECRET !== 'YOUR_INDOORATLAS_API_SECRET'
  );
}


