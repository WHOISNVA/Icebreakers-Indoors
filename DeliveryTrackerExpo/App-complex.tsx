import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface DeliveryStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'delivered';
  startTime: Date;
  endTime?: Date;
  currentLocation?: LocationData;
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
}

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

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

    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      // First check if we already have permission
      let { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        // Request permission
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
      }

      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to track delivery progress. Please enable location access in your device settings.'
        );
        return false;
      }

      // Try to request background permission, but don't fail if it's not available
      try {
        const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus.status !== 'granted') {
          console.log('Background location permission not granted, but continuing with foreground tracking');
        }
      } catch (bgError) {
        console.log('Background permission not available:', bgError);
      }

      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      Alert.alert(
        'Location Error',
        'Unable to access location. Please check your device settings and ensure location services are enabled.'
      );
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: location.timestamp,
      };

      setCurrentLocation(locationData);
      setMapRegion({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.error('Get current location error:', error);
      Alert.alert('Error', 'Failed to get current location.');
    }
  };

  const startDelivery = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      setIsTracking(true);
      
      if (deliveryStatus) {
        setDeliveryStatus(prev => prev ? {
          ...prev,
          status: 'in_progress',
        } : null);
      }

      // Start location tracking
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            timestamp: location.timestamp,
          };

          setCurrentLocation(locationData);
          setMapRegion({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });

          // Update delivery status with current location
          if (deliveryStatus) {
            setDeliveryStatus(prev => prev ? {
              ...prev,
              currentLocation: locationData,
            } : null);
          }
        }
      );

      Alert.alert('Delivery Started', 'Location tracking has been enabled for this delivery.');
    } catch (error) {
      console.error('Start delivery error:', error);
      Alert.alert('Error', 'Failed to start delivery tracking.');
    }
  };

  const stopDelivery = () => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'in_progress': return '#007AFF';
      case 'delivered': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'delivered': return 'Delivered';
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
          style={styles.map}
          region={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          mapType="standard"
          provider={undefined}
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
      {currentLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>
            Lat: {currentLocation.latitude.toFixed(6)}
          </Text>
          <Text style={styles.locationText}>
            Lng: {currentLocation.longitude.toFixed(6)}
          </Text>
          <Text style={styles.locationText}>
            Accuracy: {currentLocation.accuracy.toFixed(0)}m
          </Text>
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
}

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