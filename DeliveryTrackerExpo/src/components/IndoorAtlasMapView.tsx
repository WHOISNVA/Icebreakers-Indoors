/**
 * IndoorAtlasMapView
 * React Native component wrapper for native IndoorAtlas MapView
 * Displays indoor floor plans with real-time positioning
 * Now supports dynamic floor data from IndoorAtlas API
 */

import React, { useEffect, useState } from 'react';
import { requireNativeComponent, ViewProps, NativeSyntheticEvent, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import FloorPlanService, { VenueFloorData } from '../services/FloorPlanService';

interface LocationUpdateEvent {
  latitude: number;
  longitude: number;
  floor: number;
  accuracy: number;
  timestamp: number;
}

export interface IndoorAtlasMapViewProps extends ViewProps {
  venueId?: string;
  floorPlanId?: string;
  floorLevel?: number;
  showUserLocation?: boolean;
  venueLocation?: {
    latitude: number;
    longitude: number;
    name: string;
  };
  onLocationUpdate?: (event: NativeSyntheticEvent<LocationUpdateEvent>) => void;
  onFloorDataLoaded?: (floorData: VenueFloorData) => void;
  onFloorDataError?: (error: string) => void;
}

const NativeIndoorAtlasMapView = requireNativeComponent<IndoorAtlasMapViewProps>(
  'RNIndoorAtlasMapView'
);

export const IndoorAtlasMapView: React.FC<IndoorAtlasMapViewProps> = (props) => {
  const [floorData, setFloorData] = useState<VenueFloorData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load floor data when venue ID changes
  useEffect(() => {
    if (props.venueId) {
      loadFloorData(props.venueId);
    }
  }, [props.venueId]);

  const loadFloorData = async (venueId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log(`🏢 IndoorAtlasMapView: Loading floor data for venue: ${venueId}`);
      const data = await FloorPlanService.getVenueFloors(venueId);
      setFloorData(data);
      props.onFloorDataLoaded?.(data);
      console.log(`✅ IndoorAtlasMapView: Floor data loaded: ${data.floors.length} floors`);
      
      // If venue has location data, pass it to the native component
      if (data.venueLocation) {
        console.log(`📍 Venue location: ${data.venueLocation.latitude}, ${data.venueLocation.longitude}`);
      }
    } catch (err: any) {
      console.error('❌ IndoorAtlasMapView: Failed to load floor data:', err);
      setError(err.message || 'Failed to load floor data');
      props.onFloorDataError?.(err.message || 'Failed to load floor data');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading floor plan...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <Text style={styles.errorSubtext}>Using fallback map view</Text>
      </View>
    );
  }

  // Show native map view
  return (
    <NativeIndoorAtlasMapView
      {...props}
      venueLocation={floorData?.venueLocation}
      style={[{ flex: 1 }, props.style]}
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default IndoorAtlasMapView;

