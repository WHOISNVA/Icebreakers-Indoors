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
import MotionService from './src/services/MotionService';

const { width, height } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export default function App() {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState('pending');

  const motionService = new MotionService({
    onMotionChange: (motion) => {
      console.log('Motion changed:', motion);
      // Handle motion change (e.g., update UI or state)
    },
    onLocationBurst: (location) => {
      console.log('Location burst:', location);
      // Handle location burst (e.g., update map or state)
    },
  });

  useEffect(() => {
    motionService.startMonitoring();

    return () => {
      motionService.stopMonitoring();
    };
  }, []);

  useEffect(() => {
    // Initialize with a sample delivery
    setDeliveryStatus('pending');
  }, []);

  const getCurrentLocation = async () => {
    try {
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings.'
        );
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: location.timestamp,
      };

      setCurrentLocation(locationData);
      Alert.alert(
        'Location Found!',
        `Lat: ${locationData.latitude.toFixed(6)}\nLng: ${locationData.longitude.toFixed(6)}\nAccuracy: ${locationData.accuracy.toFixed(0)}m`
      );
    } catch (error) {
      console.error('Get current location error:', error);
      Alert.alert(
        'Location Error',
        'Failed to get current location. Please check your device settings and ensure location services are enabled.'
      );
    }
  };

  const startDelivery = async () => {
    try {
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings.'
        );
        return;
      }

      setIsTracking(true);
      setDeliveryStatus('in_progress');
      
      Alert.alert(
        'Delivery Started!',
        'Location tracking has been enabled. The app will track your location during delivery.'
      );
    } catch (error) {
      console.error('Start delivery error:', error);
      Alert.alert('Error', 'Failed to start delivery tracking.');
    }
  };

  const stopDelivery = () => {
    setIsTracking(false);
    setDeliveryStatus('delivered');
    setCurrentLocation(null);
    
    Alert.alert('Delivery Completed!', 'Location tracking has been stopped.');
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
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(deliveryStatus) }]}>
          <Text style={styles.statusText}>
            {getStatusText(deliveryStatus)}
          </Text>
        </View>
      </View>

      {/* Delivery Info */}
      <View style={styles.deliveryInfo}>
        <Text style={styles.customerName}>John Doe</Text>
        <Text style={styles.deliveryAddress}>123 Main St, San Francisco, CA</Text>
        <Text style={styles.customerPhone}>+1 (555) 123-4567</Text>
        <Text style={styles.notes}>Notes: Leave at front door if no answer</Text>
      </View>

      {/* Location Display */}
      <View style={styles.locationContainer}>
        <Text style={styles.locationTitle}>Current Location</Text>
        {currentLocation ? (
          <View style={styles.locationDetails}>
            <Text style={styles.locationText}>
              Latitude: {currentLocation.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              Longitude: {currentLocation.longitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              Accuracy: {currentLocation.accuracy.toFixed(0)} meters
            </Text>
            <Text style={styles.locationText}>
              Time: {new Date(currentLocation.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        ) : (
          <Text style={styles.noLocationText}>
            No location data available. Tap "Get Location" to find your current position.
          </Text>
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

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How to Test:</Text>
        <Text style={styles.instructionsText}>1. Tap "Get Location" to find your current position</Text>
        <Text style={styles.instructionsText}>2. Tap "Start Delivery" to begin tracking</Text>
        <Text style={styles.instructionsText}>3. Move around to test location updates</Text>
        <Text style={styles.instructionsText}>4. Tap "Complete Delivery" to stop tracking</Text>
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
  locationContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  locationDetails: {
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#3C3C43',
    fontFamily: 'monospace',
  },
  noLocationText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  instructions: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: '#3C3C43',
    marginBottom: 4,
  },
});
