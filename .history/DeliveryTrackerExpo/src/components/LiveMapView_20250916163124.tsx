import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Order } from '../types/order';
import { orderService } from '../services/OrderService';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

interface LiveMapViewProps {
  visible: boolean;
  onClose: () => void;
}

export default function LiveMapView({ visible, onClose }: LiveMapViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [barLocation, setBarLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!visible) return;

    // Subscribe to order updates
    const unsubscribe = orderService.subscribe((newOrders) => {
      // Filter only active orders
      const activeOrders = newOrders.filter(o => o.status !== 'completed');
      setOrders(activeOrders);
    });

    // Get bar location
    const getBarLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Balanced 
          });
          setBarLocation({ 
            latitude: location.coords.latitude, 
            longitude: location.coords.longitude 
          });
        }
      } catch (e) {
        console.warn('Could not get bar location:', e);
      }
    };
    getBarLocation();

    return () => {
      unsubscribe();
    };
  }, [visible]);

  const getMarkerColor = (order: Order) => {
    if (order.currentLocation) return '#10b981'; // Green for updated location
    return '#3b82f6'; // Blue for original location
  };

  const getOrderLocation = (order: Order) => {
    return order.currentLocation || order.origin;
  };

  const fitAllMarkers = () => {
    if (!mapRef.current || orders.length === 0) return;

    const coordinates = orders.map(order => {
      const loc = getOrderLocation(order);
      return {
        latitude: loc.latitude,
        longitude: loc.longitude,
      };
    });

    if (barLocation) {
      coordinates.push(barLocation);
    }

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
      animated: true,
    });
  };

  useEffect(() => {
    if (visible && orders.length > 0) {
      setTimeout(fitAllMarkers, 500);
    }
  }, [visible, orders.length]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Live Order Map</Text>
            <Text style={styles.subtitle}>{orders.length} active orders</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: barLocation?.latitude || 37.78825,
            longitude: barLocation?.longitude || -122.4324,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          showsMyLocationButton={true}
          showsCompass={true}
        >
          {/* Bar location marker */}
          {barLocation && (
            <Marker
              coordinate={barLocation}
              title="Bar Location"
              description="Your current location"
              pinColor="#ef4444"
            />
          )}

          {/* Order markers */}
          {orders.map((order) => {
            const location = getOrderLocation(order);
            return (
              <Marker
                key={order.id}
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title={`Order ${order.id}`}
                description={order.currentLocation ? 'Location Updated' : 'Original Location'}
                pinColor={getMarkerColor(order)}
                onPress={() => setSelectedOrder(order)}
              />
            );
          })}
        </MapView>

        {/* Order Details Bottom Sheet */}
        <ScrollView style={styles.bottomSheet} showsVerticalScrollIndicator={false}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Bar</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>Original</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Updated</Text>
            </View>
          </View>

          {selectedOrder ? (
            <View style={styles.orderDetails}>
              <Text style={styles.orderTitle}>Order {selectedOrder.id}</Text>
              <Text style={styles.orderTime}>
                {new Date(selectedOrder.createdAt).toLocaleTimeString()}
              </Text>
              
              <View style={styles.itemsSection}>
                {selectedOrder.items.map((item) => (
                  <Text key={item.id} style={styles.orderItem}>
                    • {item.name} x{item.quantity}
                  </Text>
                ))}
              </View>

              {selectedOrder.detailsNote && (
                <Text style={styles.orderNote}>Note: {selectedOrder.detailsNote}</Text>
              )}

              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>
                  {selectedOrder.currentLocation ? 'Current Location:' : 'Location:'}
                </Text>
                <Text style={styles.locationCoords}>
                  {getOrderLocation(selectedOrder).latitude.toFixed(6)}, {getOrderLocation(selectedOrder).longitude.toFixed(6)}
                </Text>
                {selectedOrder.currentLocation && (
                  <Text style={styles.updateTime}>
                    Updated: {new Date(selectedOrder.currentLocation.timestamp).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.selectPrompt}>Tap a marker to see order details</Text>
          )}

          <TouchableOpacity style={styles.fitButton} onPress={fitAllMarkers}>
            <Text style={styles.fitButtonText}>Fit All Orders</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    maxHeight: height * 0.4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    paddingTop: 20,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    color: '#3C3C43',
  },
  orderDetails: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  orderTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  itemsSection: {
    marginBottom: 12,
  },
  orderItem: {
    fontSize: 15,
    color: '#1C1C1E',
    marginBottom: 2,
  },
  orderNote: {
    fontSize: 14,
    color: '#3C3C43',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  locationInfo: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  locationLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 14,
    color: '#1C1C1E',
    fontFamily: 'monospace',
  },
  updateTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  selectPrompt: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 15,
    paddingVertical: 30,
  },
  fitButton: {
    marginHorizontal: 20,
    marginVertical: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  fitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
