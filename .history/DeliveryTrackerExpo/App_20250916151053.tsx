import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import MotionService from './src/services/MotionService';

const { width, height } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isMotionRefined?: boolean;
}

export default function App() {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState('pending');
  const [currentMotion, setCurrentMotion] = useState<string>('unknown');
  const [locationWatchSubscription, setLocationWatchSubscription] = useState<any>(null);
  const mapRef = useRef<MapView>(null);

  const motionService = new MotionService({
    onMotionChange: (motion) => {
      console.log('Motion changed:', motion);
      setCurrentMotion(motion.activity);
    },
    onLocationBurst: (location) => {
      console.log('Location burst:', location);
      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: location.timestamp,
        isMotionRefined: (location.coords.accuracy || 0) <= 1.0
      };
      setCurrentLocation(locationData);
      
      // Animate map to new location
      if (mapRef.current && locationData) {
        mapRef.current.animateToRegion({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          latitudeDelta: 0.001,
          longitudeDelta: 0.001,
        }, 500);
      }
    },
  });

  useEffect(() => {
    motionService.startMonitoring();

    return () => {
      motionService.stopMonitoring();
      if (locationWatchSubscription) {
        locationWatchSubscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for this app to function.');
        return;
      }
      
      // Request background location for better accuracy
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        console.log('Background location permission granted - enhanced accuracy available');
      }
    })();

    // Initialize with a sample delivery
    setDeliveryStatus('pending');
  }, []);

  useEffect(() => {
    // Start continuous location tracking when tracking is enabled
    if (isTracking) {
      startContinuousLocationTracking();
    } else if (locationWatchSubscription) {
      locationWatchSubscription.remove();
      setLocationWatchSubscription(null);
    }
  }, [isTracking]);

  const startContinuousLocationTracking = async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 1, // Update on any movement
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            timestamp: location.timestamp,
          };
          setCurrentLocation(locationData);
          
          // Smoothly animate to new location
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              latitudeDelta: 0.001,
              longitudeDelta: 0.001,
            }, 300);
          }
        }
      );
      setLocationWatchSubscription(subscription);
    } catch (error) {
      console.error('Error starting continuous location tracking:', error);
    }
  };

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

      // Enable network provider for better accuracy
      await Location.enableNetworkProviderAsync().catch(() => {
        console.log('Network provider not available');
      });

      // Get multiple readings for better accuracy
      const readings: Location.LocationObject[] = [];
      
      // Take 3 quick readings
      for (let i = 0; i < 3; i++) {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          mayShowUserSettingsDialog: true,
        });
        readings.push(location);
        
        // Small delay between readings
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Find the most accurate reading
      const bestReading = readings.reduce((best, current) => 
        (current.coords.accuracy || Infinity) < (best.coords.accuracy || Infinity) ? current : best
      );

      const locationData: LocationData = {
        latitude: bestReading.coords.latitude,
        longitude: bestReading.coords.longitude,
        accuracy: bestReading.coords.accuracy || 0,
        timestamp: bestReading.timestamp,
      };

      setCurrentLocation(locationData);
      Alert.alert(
        'Location Found!',
        `Lat: ${locationData.latitude.toFixed(6)}\nLng: ${locationData.longitude.toFixed(6)}\nAccuracy: ${locationData.accuracy.toFixed(1)}m (${(locationData.accuracy * 3.28084).toFixed(1)}ft)`
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

  const getMotionColor = (motion: string) => {
    switch (motion) {
      case 'SIT': return '#34C759';
      case 'WALK': return '#007AFF';
      case 'RUN': return '#FF9500';
      default: return '#8E8E93';
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

      {/* Map View */}
      <View style={styles.mapContainer}>
        {currentLocation ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.001,
              longitudeDelta: 0.001,
            }}
            showsUserLocation={false}
            showsMyLocationButton={true}
            showsCompass={true}
            loadingEnabled={true}
          >
            {/* User location marker */}
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title="Your Location"
              description={`Accuracy: ${currentLocation.accuracy.toFixed(1)}m | ${currentMotion}`}
              pinColor={getMotionColor(currentMotion)}
            />
            
            {/* Accuracy circle */}
            <Circle
              center={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              radius={currentLocation.accuracy}
              fillColor="rgba(0, 122, 255, 0.1)"
              strokeColor="rgba(0, 122, 255, 0.3)"
              strokeWidth={1}
            />
          </MapView>
        ) : (
          <View style={styles.noMapView}>
            <Text style={styles.noMapText}>
              Tap "Get Location" to initialize the map
            </Text>
          </View>
        )}
        
        {/* Motion Status Overlay */}
        <View style={styles.motionOverlay}>
          <View style={[styles.motionBadge, { backgroundColor: getMotionColor(currentMotion) }]}>
            <Text style={styles.motionBadgeText}>
              {currentMotion === 'SIT' ? '🪑' : currentMotion === 'WALK' ? '🚶' : currentMotion === 'RUN' ? '🏃' : '❓'} {currentMotion}
            </Text>
          </View>
          {currentLocation && (
            <View style={styles.accuracyBadge}>
              <Text style={styles.accuracyBadgeText}>
                📍 {currentLocation.accuracy.toFixed(1)}m ({(currentLocation.accuracy * 3.28084).toFixed(1)}ft)
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Controls */}
      <ScrollView style={styles.bottomContainer} showsVerticalScrollIndicator={false}>
        {/* Delivery Info */}
        <View style={styles.deliveryInfo}>
          <Text style={styles.customerName}>John Doe</Text>
          <Text style={styles.deliveryAddress}>123 Main St, San Francisco, CA</Text>
          <Text style={styles.customerPhone}>+1 (555) 123-4567</Text>
          <Text style={styles.notes}>Notes: Leave at front door if no answer</Text>
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

        {/* Location Details */}
        {currentLocation && (
          <View style={styles.locationDetails}>
            <Text style={styles.locationDetailsTitle}>Location Details</Text>
            <Text style={styles.locationText}>
              Lat: {currentLocation.latitude.toFixed(6)} | Lng: {currentLocation.longitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              Time: {new Date(currentLocation.timestamp).toLocaleTimeString()}
            </Text>
            {currentLocation.isMotionRefined && (
              <Text style={styles.motionRefinedText}>
                ✓ Motion-Refined Position
              </Text>
            )}
          </View>
        )}
      </ScrollView>
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
    zIndex: 1,
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  noMapView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  noMapText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  motionOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  motionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  motionBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  accuracyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  accuracyBadgeText: {
    color: '#1C1C1E',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomContainer: {
    backgroundColor: '#FFFFFF',
    maxHeight: height * 0.4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  deliveryInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
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
  controls: {
    flexDirection: 'row',
    padding: 20,
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
  locationDetails: {
    padding: 20,
    paddingTop: 0,
  },
  locationDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    color: '#3C3C43',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  motionRefinedText: {
    fontSize: 12,
    color: '#34C759',
    fontStyle: 'italic',
    marginTop: 4,
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
  noLocationText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
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
  highAccuracyText: {
    color: '#34C759',
    fontWeight: 'bold',
  },
  motionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  motionStatusLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  motionStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
