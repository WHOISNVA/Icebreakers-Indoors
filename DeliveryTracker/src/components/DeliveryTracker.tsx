import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import LocationService, { LocationData } from '../services/LocationService';
import LiveLocationService, { LiveLocationData } from '../services/LiveLocationService';
import PingService, { PingData } from '../services/PingService';
import MapMatchingService, { MatchedLocation } from '../services/MapMatchingService';
import { DeliveryStatus, MapRegion } from '../types';
import { MAP_CONFIG } from '../config/maps';
import { formatLocation, formatDistance, formatSpeed, isValidLocation } from '../utils/locationUtils';

const { width, height } = Dimensions.get('window');

const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const DeliveryTracker: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(null);
  const [mapRegion, setMapRegion] = useState<MapRegion>({
    latitude: MAP_CONFIG.DEFAULT_LATITUDE,
    longitude: MAP_CONFIG.DEFAULT_LONGITUDE,
    latitudeDelta: MAP_CONFIG.LATITUDE_DELTA,
    longitudeDelta: MAP_CONFIG.LONGITUDE_DELTA,
  });
  
  // New state for enhanced features
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [liveLocation, setLiveLocation] = useState<LiveLocationData | null>(null);
  const [matchedLocation, setMatchedLocation] = useState<MatchedLocation | null>(null);
  const [isPingEnabled, setIsPingEnabled] = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Initialize with a sample delivery
    const sampleDelivery: DeliveryStatus = {
      id: 'delivery-001',
      status: 'pending',
      startTime: new Date(),
      deliveryAddress: '123 Main St, San Francisco, CA',
      customerName: 'John Doe',
      customerPhone: '+1 (555) 123-4567',
      notes: 'Leave at front door if no answer',
    };
    
    setDeliveryStatus(sampleDelivery);
    
    // Set up ping service
    PingService.setCurrentUserId('user-123');
    
    // Subscribe to ping notifications for this delivery
    PingService.subscribeToPings(
      sampleDelivery.id,
      (ping: PingData) => {
        console.log('Ping received:', ping);
        Alert.alert('Ping Received!', `Bartender is looking for you at ${ping.message}`);
      },
      (error) => {
        console.error('Ping subscription error:', error);
      }
    );

    return () => {
      LocationService.stopTracking();
      LiveLocationService.stopSharing();
      PingService.unsubscribeFromPings(sampleDelivery.id);
    };
  }, []);

  const startDelivery = async () => {
    try {
      const success = await LocationService.startTracking(
        async (location: LocationData) => {
          setCurrentLocation(location);
          setMapRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          });

          // Apply map matching
          const matched = MapMatchingService.matchLocation(location);
          setMatchedLocation(matched);

          // Start live location sharing
          if (deliveryStatus && !isSharingLocation) {
            const liveSharingSuccess = await LiveLocationService.startSharing(
              'user-123', // Current user ID
              deliveryStatus.id,
              location,
              5000 // Update every 5 seconds
            );
            
            if (liveSharingSuccess) {
              setIsSharingLocation(true);
            }
          }

          // Update live location if already sharing
          if (isSharingLocation) {
            await LiveLocationService.updateLocation(location);
          }

          // Update delivery status with current location
          if (deliveryStatus) {
            setDeliveryStatus(prev => prev ? {
              ...prev,
              status: 'in_progress',
              currentLocation: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                timestamp: location.timestamp,
              },
            } : null);
          }
        },
        (error) => {
          console.error('Location tracking error:', error);
          Alert.alert('Location Error', 'Failed to track location. Please check your settings.');
        }
      );

      if (success) {
        setIsTracking(true);
        setIsPingEnabled(true);
        Alert.alert('Delivery Started', 'Location tracking and live sharing have been enabled for this delivery.');
      } else {
        Alert.alert('Error', 'Failed to start location tracking. Please check permissions.');
      }
    } catch (error) {
      console.error('Start delivery error:', error);
      Alert.alert('Error', 'Failed to start delivery tracking.');
    }
  };

  const stopDelivery = async () => {
    LocationService.stopTracking();
    await LiveLocationService.stopSharing();
    
    setIsTracking(false);
    setIsSharingLocation(false);
    setIsPingEnabled(false);
    setCurrentLocation(null);
    setMatchedLocation(null);
    
    if (deliveryStatus) {
      setDeliveryStatus(prev => prev ? {
        ...prev,
        status: 'delivered',
        endTime: new Date(),
      } : null);
    }
    
    Alert.alert('Delivery Completed', 'Location tracking and live sharing have been stopped.');
  };

  const sendPing = async () => {
    if (!deliveryStatus || !isPingEnabled) {
      Alert.alert('Error', 'Cannot send ping. Delivery not active.');
      return;
    }

    try {
      const success = await PingService.sendPing(
        deliveryStatus.id,
        'bartender-456', // Target bartender ID
        'Find my guest - I need help locating you!'
      );

      if (success) {
        Alert.alert('Ping Sent', 'The bartender has been notified to help locate you.');
      } else {
        Alert.alert('Error', 'Failed to send ping. Please try again.');
      }
    } catch (error) {
      console.error('Send ping error:', error);
      Alert.alert('Error', 'Failed to send ping.');
    }
  };

  const getCurrentLocation = async () => {
    try {
      // Use enhanced location that combines GPS, WiFi, and cell signals
      const location = await LocationService.getEnhancedLocation();
      if (location) {
        setCurrentLocation(location);
        setMapRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        });
        
        // Apply map matching
        const matched = MapMatchingService.matchLocation(location);
        setMatchedLocation(matched);
        
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          });
        }
      }
    } catch (error) {
      console.error('Get current location error:', error);
      Alert.alert('Error', 'Failed to get current location.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'in_progress': return '#007AFF';
      case 'delivered': return '#34C759';
      case 'cancelled': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Delivery Tracker</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(deliveryStatus?.status || 'pending') }]}>
          <Text style={styles.statusText}>
            {getStatusText(deliveryStatus?.status || 'pending')}
          </Text>
        </View>
      </View>

      {/* Delivery Info */}
      {deliveryStatus && (
        <View style={styles.deliveryInfo}>
          <Text style={styles.customerName}>{deliveryStatus.customerName}</Text>
          <Text style={styles.deliveryAddress}>{deliveryStatus.deliveryAddress}</Text>
          <Text style={styles.customerPhone}>{deliveryStatus.customerPhone}</Text>
          {deliveryStatus.notes && (
            <Text style={styles.notes}>Notes: {deliveryStatus.notes}</Text>
          )}
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          mapType="standard"
        >
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title="Current Location"
              description={`Accuracy: ${currentLocation.accuracy.toFixed(0)}m`}
              pinColor="#007AFF"
            />
          )}
        </MapView>
      </View>

      {/* Location Info */}
      {currentLocation && isValidLocation(currentLocation) && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>
            {formatLocation(currentLocation)}
          </Text>
          <Text style={styles.locationText}>
            Accuracy: {formatDistance(currentLocation.accuracy)}
          </Text>
          {currentLocation.speed && (
            <Text style={styles.locationText}>
              Speed: {formatSpeed(currentLocation.speed)}
            </Text>
          )}
          {matchedLocation && matchedLocation.isMatched && (
            <Text style={[styles.locationText, styles.zoneText]}>
              Zone: {matchedLocation.matchedZone?.name}
            </Text>
          )}
        </View>
      )}

      {/* Enhanced Features Status */}
      <View style={styles.featuresStatus}>
        <View style={styles.featureItem}>
          <Text style={styles.featureLabel}>Live Sharing:</Text>
          <Text style={[styles.featureValue, { color: isSharingLocation ? '#34C759' : '#FF3B30' }]}>
            {isSharingLocation ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureLabel}>Ping:</Text>
          <Text style={[styles.featureValue, { color: isPingEnabled ? '#34C759' : '#FF3B30' }]}>
            {isPingEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
        {matchedLocation && matchedLocation.isMatched && (
          <View style={styles.featureItem}>
            <Text style={styles.featureLabel}>Zone Match:</Text>
            <Text style={[styles.featureValue, { color: '#007AFF' }]}>
              {matchedLocation.confidence > 0.8 ? 'High' : 'Medium'}
            </Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={getCurrentLocation}
        >
          <Text style={styles.buttonText}>Get Location</Text>
        </TouchableOpacity>

        {!isTracking ? (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={startDelivery}
          >
            <Text style={[styles.buttonText, styles.primaryButtonText]}>
              Start Delivery
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={stopDelivery}
          >
            <Text style={[styles.buttonText, styles.stopButtonText]}>
              Complete Delivery
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Ping Button */}
      {isPingEnabled && (
        <View style={styles.pingContainer}>
          <TouchableOpacity
            style={[styles.button, styles.pingButton]}
            onPress={sendPing}
          >
            <Text style={[styles.buttonText, styles.pingButtonText]}>
              🔔 Ping Bartender
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryInfo: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  deliveryAddress: {
    fontSize: 16,
    color: '#3C3C43',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  locationInfo: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  locationText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  zoneText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  featuresStatus: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  featureItem: {
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  featureValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  pingContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  pingButton: {
    backgroundColor: '#FF9500',
  },
  pingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#C7C7CC',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  stopButtonText: {
    color: '#FFFFFF',
  },
});

export default DeliveryTracker;
