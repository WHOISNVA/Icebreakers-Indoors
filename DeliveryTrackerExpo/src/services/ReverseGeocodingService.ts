/**
 * Reverse Geocoding Service
 * Converts coordinates to human-readable addresses
 */

export interface AddressInfo {
  address: string;
  city: string;
  country: string;
  postalCode?: string;
  state?: string;
}

class ReverseGeocodingService {
  private cache: Map<string, AddressInfo> = new Map();

  /**
   * Get address from coordinates using reverse geocoding
   */
  async getAddress(latitude: number, longitude: number): Promise<AddressInfo> {
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`📍 Using cached address for ${latitude}, ${longitude}`);
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log(`🌍 Getting address for coordinates: ${latitude}, ${longitude}`);
      
      // Try multiple reverse geocoding services
      let addressInfo: AddressInfo;
      
      try {
        // Method 1: Google Maps Geocoding API (if you have API key)
        addressInfo = await this.getAddressFromGoogleMaps(latitude, longitude);
      } catch (error) {
        console.warn('Google Maps API failed, trying alternative:', error);
        
        try {
          // Method 2: OpenStreetMap Nominatim (free)
          addressInfo = await this.getAddressFromNominatim(latitude, longitude);
        } catch (error) {
          console.warn('Nominatim failed, using fallback:', error);
          
          // Method 3: Fallback to coordinates
          addressInfo = this.getFallbackAddress(latitude, longitude);
        }
      }
      
      // Cache the result
      this.cache.set(cacheKey, addressInfo);
      
      console.log(`📍 Address found: ${addressInfo.address}, ${addressInfo.city}`);
      return addressInfo;
      
    } catch (error) {
      console.error('❌ All reverse geocoding methods failed:', error);
      return this.getFallbackAddress(latitude, longitude);
    }
  }

  /**
   * Get address using Google Maps Geocoding API
   */
  private async getAddressFromGoogleMaps(latitude: number, longitude: number): Promise<AddressInfo> {
    // You would need a Google Maps API key for this
    // const API_KEY = 'your-google-maps-api-key';
    // const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${API_KEY}`;
    
    // For now, throw error to use alternative method
    throw new Error('Google Maps API not configured');
  }

  /**
   * Get address using OpenStreetMap Nominatim (free service)
   */
  private async getAddressFromNominatim(latitude: number, longitude: number): Promise<AddressInfo> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DeliveryTrackerExpo/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Nominatim API failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.display_name) {
      throw new Error('No address data from Nominatim');
    }
    
    return {
      address: data.display_name,
      city: data.address?.city || data.address?.town || data.address?.village || 'Unknown',
      country: data.address?.country || 'Unknown',
      postalCode: data.address?.postcode,
      state: data.address?.state
    };
  }

  /**
   * Fallback address when all services fail
   */
  private getFallbackAddress(latitude: number, longitude: number): AddressInfo {
    return {
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      city: 'Unknown City',
      country: 'Unknown Country'
    };
  }

  /**
   * Clear address cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cleared address cache');
  }

  /**
   * Get cached address count
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

export default new ReverseGeocodingService();
