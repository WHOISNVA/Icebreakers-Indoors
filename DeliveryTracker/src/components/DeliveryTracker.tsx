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

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Initialize with a sample delivery
    setDeliveryStatus({
      id: 'delivery-001',
      status: 'pending',
      startTime: new Date(),
      deliveryAddress: '123 Main St, San Francisco, CA',
      customerName: 'John Doe',
      customerPhone: '+1 (555) 123-4567',
      notes: 'Leave at front door if no answer',
    });

    return () => {
      LocationService.stopTracking();
    };
  }, []);

  const startDelivery = async () => {
    try {
      const success = await LocationService.startTracking(
        (location: LocationData) => {
          setCurrentLocation(location);
          setMapRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          });

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
        Alert.alert('Delivery Started', 'Location tracking has been enabled for this delivery.');
      } else {
        Alert.alert('Error', 'Failed to start location tracking. Please check permissions.');
      }
    } catch (error) {
      console.error('Start delivery error:', error);
      Alert.alert('Error', 'Failed to start delivery tracking.');
    }
  };

  const stopDelivery = () => {
    LocationService.stopTracking();
    setIsTracking(false);
    setCurrentLocation(null);
    
    if (deliveryStatus) {
      setDeliveryStatus(prev => prev ? {
        ...prev,
        status: 'delivered',
        endTime: new Date(),
      } : null);
    }
    
    Alert.alert('Delivery Completed', 'Location tracking has been stopped.');
  };

  const getCurrentLocation = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        setMapRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        });
        
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
        </View>
      )}

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
