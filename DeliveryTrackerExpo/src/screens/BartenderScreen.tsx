import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert, Modal } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { orderService } from '../services/OrderService';
import { Order } from '../types/order';
import * as Location from 'expo-location';
import PingService from '../services/PingService';
import DeliveryTrackingService from '../services/DeliveryTrackingService';
import { formatDistance, formatFloor, resetBuildingBaseAltitude, getBuildingBaseAltitude, setFloorOffset, getFloorOffset } from '../utils/locationUtils';
import ARNavigationView from '../components/ARNavigationView';

function mapsUrl(lat: number, lng: number): string {
  const q = `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

type SortOption = 'timestamp' | 'proximity';

export default function BartenderScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('timestamp');
  const [barLocation, setBarLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showARView, setShowARView] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<any>(null);

  useEffect(() => {
    // Set bartender user ID for ping service
    PingService.setCurrentUserId('bartender-123');
    
    // Start tracking server location
    DeliveryTrackingService.startServerTracking();
    
    // Subscribe to orders
    const unsubscribe = orderService.subscribe(setOrders);
    
    return () => {
      unsubscribe();
      DeliveryTrackingService.stopServerTracking();
    };
  }, []);

  useEffect(() => {
    // Get bar location for proximity sorting
    const getBarLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setBarLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        }
      } catch (e) {
        console.warn('Could not get bar location:', e);
      }
    };
    getBarLocation();
  }, []);

  // Update delivery status periodically
  useEffect(() => {
    if (selectedOrder) {
      const interval = setInterval(() => {
        const status = DeliveryTrackingService.getDeliveryStatus(selectedOrder.id);
        setDeliveryStatus(status);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [selectedOrder]);

  const openDirections = (o: Order) => {
    Linking.openURL(mapsUrl(o.origin.latitude, o.origin.longitude)).catch(() => {});
  };

  const sendPingToCustomer = async (orderId: string) => {
    try {
      console.log(`🔔 BartenderScreen: Sending ping for order: ${orderId} to user: user-123`);
      const success = await PingService.sendPing(
        orderId,
        'user-123', // Customer user ID
        'Your order is ready! Come pick it up at the bar.'
      );

      console.log(`🔔 BartenderScreen: Ping send result: ${success}`);

      if (success) {
        Alert.alert('Ping Sent', 'The customer has been notified that their order is ready.');
      } else {
        Alert.alert('Error', 'Failed to send ping.');
      }
    } catch (error) {
      console.error('🔔 BartenderScreen: Error sending ping:', error);
      Alert.alert('Error', 'Failed to send ping.');
    }
  };

  const handleResetFloorCalibration = () => {
    const currentBase = getBuildingBaseAltitude();
    const currentOffset = getFloorOffset();
    
    Alert.alert(
      '🏢 Floor Calibration',
      currentBase 
        ? `Base altitude: ${currentBase.toFixed(1)}m\nFloor offset: ${currentOffset > 0 ? '+' : ''}${currentOffset}\n\nWhat would you like to do?`
        : 'No calibration yet. First order will set the reference.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Current Floor',
          onPress: () => {
            Alert.prompt(
              'What floor are you on?',
              'Enter the current floor number (0 = ground floor)',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Set',
                  onPress: (value?: string) => {
                    const floor = parseInt(value || '0', 10);
                    if (!isNaN(floor)) {
                      setFloorOffset(floor);
                      Alert.alert('✅ Floor Set', `Current location is now ${formatFloor(floor)}`);
                    }
                  },
                },
              ],
              'plain-text',
              '3'
            );
          },
        },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: () => {
            resetBuildingBaseAltitude();
            Alert.alert('✅ Reset Complete', 'Floor calibration cleared. Place a new order to recalibrate.');
          },
        },
      ]
    );
  };

  const openDeliveryMap = (order?: Order) => {
    if (order) {
      setSelectedOrder(order);
      
      // Start tracking this specific delivery
      const location = order.currentLocation || order.origin;
      DeliveryTrackingService.trackDelivery(
        order.id,
        { latitude: location.latitude, longitude: location.longitude },
        (orderId) => {
          // Called when server arrives
          Alert.alert(
            '✅ Arrived!',
            `You've reached the customer location for order ${orderId}`,
            [
              {
                text: 'Mark Delivered',
                onPress: () => {
                  orderService.updateStatus(orderId, 'completed');
                  setSelectedOrder(null);
                  DeliveryTrackingService.stopTrackingDelivery(orderId);
                },
              },
              {
                text: 'Continue',
                style: 'cancel',
              },
            ]
          );
        }
      );
    }
    
    setShowMapModal(true);
  };

  const closeMap = () => {
    if (selectedOrder) {
      DeliveryTrackingService.stopTrackingDelivery(selectedOrder.id);
    }
    setShowMapModal(false);
    setSelectedOrder(null);
    setDeliveryStatus(null);
  };

  const openARNavigation = (order: Order) => {
    setSelectedOrder(order);
    setShowARView(true);
    
    // Start tracking this delivery
    const location = order.currentLocation || order.origin;
    DeliveryTrackingService.trackDelivery(
      order.id,
      { latitude: location.latitude, longitude: location.longitude },
      (orderId) => {
        // Called when server arrives - already handled in AR view
        console.log(`Arrived at ${orderId} via AR navigation`);
      }
    );
  };

  const closeARView = () => {
    if (selectedOrder) {
      DeliveryTrackingService.stopTrackingDelivery(selectedOrder.id);
    }
    setShowARView(false);
  };

  const handleARArrival = () => {
    if (selectedOrder) {
      Alert.alert(
        '✅ Arrived!',
        `You've reached the customer location`,
        [
          {
            text: 'Mark Delivered',
            onPress: () => {
              orderService.updateStatus(selectedOrder.id, 'completed');
              setShowARView(false);
              setSelectedOrder(null);
              DeliveryTrackingService.stopTrackingDelivery(selectedOrder.id);
            },
          },
          {
            text: 'Continue',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const switchToARMode = () => {
    if (selectedOrder) {
      setShowMapModal(false);
      setShowARView(true);
    }
  };

  const markDelivered = () => {
    if (selectedOrder) {
      Alert.alert(
        'Confirm Delivery',
        'Mark this order as delivered?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delivered',
            onPress: () => {
              orderService.updateStatus(selectedOrder.id, 'completed');
              DeliveryTrackingService.stopTrackingDelivery(selectedOrder.id);
              closeMap();
            },
          },
        ]
      );
    }
  };

  const pending = useMemo(() => {
    let filtered = orders.filter(o => o.status !== 'completed');
    
    if (sortBy === 'timestamp') {
      return filtered.sort((a, b) => b.createdAt - a.createdAt); // newest first
    } else if (sortBy === 'proximity' && barLocation) {
      return filtered.sort((a, b) => {
        const distA = calculateDistance(barLocation, a.origin);
        const distB = calculateDistance(barLocation, b.origin);
        return distA - distB; // closest first
      });
    }
    
    return filtered;
  }, [orders, sortBy, barLocation]);
  const completed = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <Text style={styles.orderId}>Order {item.id}</Text>
      <Text style={styles.meta}>Time: {new Date(item.createdAt).toLocaleTimeString()}</Text>
      <Text style={styles.meta}>
        From: {item.origin.latitude.toFixed(6)}, {item.origin.longitude.toFixed(6)}
        {item.origin.accuracy ? ` (±${Math.round(item.origin.accuracy)}m)` : ''}
        {item.origin.floor !== null && item.origin.floor !== undefined && ` • ${formatFloor(item.origin.floor)}`}
      </Text>
      {item.currentLocation && (
        <Text style={styles.meta}>
          Current: {item.currentLocation.latitude.toFixed(6)}, {item.currentLocation.longitude.toFixed(6)}
          {item.currentLocation.accuracy ? ` (±${Math.round(item.currentLocation.accuracy)}m)` : ''}
          {item.currentLocation.floor !== null && item.currentLocation.floor !== undefined && ` • ${formatFloor(item.currentLocation.floor)}`}
        </Text>
      )}
      <View style={styles.items}>
        {item.items.map(it => (
          <Text key={it.id} style={styles.item}>
            {it.name} x{it.quantity}
          </Text>
        ))}
      </View>
      {item.detailsNote ? (
        <Text style={styles.note}>Note: {item.detailsNote}</Text>
      ) : null}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.navigate]} onPress={() => openDeliveryMap(item)}>
          <Text style={styles.btnText}>🗺️ Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.ping]} onPress={() => sendPingToCustomer(item.id)}>
          <Text style={styles.btnText}>🔔 Ping</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => orderService.updateStatus(item.id, 'completed')}>
          <Text style={[styles.btnText, styles.secondaryText]}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const unfulfilled = useMemo(() => orders.filter(o => o.status !== 'completed'), [orders]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Incoming Orders</Text>
        {unfulfilled.length > 0 && (
          <TouchableOpacity style={styles.viewAllBtn} onPress={() => openDeliveryMap()}>
            <Text style={styles.viewAllText}>🗺️ View All ({unfulfilled.length})</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.sortContainer}>
        <TouchableOpacity 
          style={[styles.sortBtn, sortBy === 'timestamp' ? styles.sortActive : null]} 
          onPress={() => setSortBy('timestamp')}
        >
          <Text style={[styles.sortText, sortBy === 'timestamp' ? styles.sortTextActive : null]}>By Time</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortBtn, sortBy === 'proximity' ? styles.sortActive : null]} 
          onPress={() => setSortBy('proximity')}
        >
          <Text style={[styles.sortText, sortBy === 'proximity' ? styles.sortTextActive : null]}>By Distance</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.calibrateBtn} 
          onPress={handleResetFloorCalibration}
        >
          <Text style={styles.calibrateText}>🏢 Floor Cal.</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList data={pending} keyExtractor={o => o.id} renderItem={renderOrder} ItemSeparatorComponent={() => <View style={styles.sep} />} ListEmptyComponent={<Text style={styles.empty}>No active orders</Text>} />

      {completed.length > 0 && (
        <>
          <TouchableOpacity 
            style={styles.completedHeader} 
            onPress={() => setShowCompletedOrders(!showCompletedOrders)}
          >
            <Text style={styles.subTitle}>
              {showCompletedOrders ? '▼' : '▶'} Completed ({completed.length})
            </Text>
            <Text style={styles.completedToggleHint}>
              {showCompletedOrders ? 'Tap to hide' : 'Tap to view'}
            </Text>
          </TouchableOpacity>
          
          {showCompletedOrders && (
            <FlatList 
              data={completed} 
              keyExtractor={o => o.id} 
              renderItem={({ item }) => (
                <View style={[styles.card, styles.completedCard]}>
                  <Text style={styles.orderId}>Order {item.id}</Text>
                  <Text style={styles.meta}>Completed at {new Date(item.createdAt).toLocaleTimeString()}</Text>
                  {item.currentLocation && (
                    <Text style={styles.meta}>
                      Last Known: {item.currentLocation.latitude.toFixed(6)}, {item.currentLocation.longitude.toFixed(6)}
                    </Text>
                  )}
                  {item.detailsNote ? (
                    <Text style={styles.note}>Note: {item.detailsNote}</Text>
                  ) : null}
                </View>
              )} 
              ItemSeparatorComponent={() => <View style={styles.sep} />} 
            />
          )}
        </>
      )}

      {/* Delivery Map Modal */}
      <Modal visible={showMapModal} animationType="slide" onRequestClose={closeMap}>
        <View style={styles.mapContainer}>
          {showMapModal && (
            <>
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={
                  selectedOrder && deliveryStatus
                    ? {
                        latitude: deliveryStatus.customerLocation.latitude,
                        longitude: deliveryStatus.customerLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }
                    : barLocation
                    ? {
                        latitude: barLocation.latitude,
                        longitude: barLocation.longitude,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      }
                    : undefined
                }
                showsUserLocation={true}
                showsMyLocationButton={true}
                followsUserLocation={!selectedOrder} // Follow when viewing all
                showsBuildings={true} // Enable 3D buildings
                showsIndoors={true} // Show indoor floor plans
                pitchEnabled={true} // Allow 3D tilt
                rotateEnabled={true} // Allow rotation
                showsCompass={true} // Show compass
              >
                {/* Show ALL unfulfilled order markers */}
                {pending.map((order) => {
                  const location = order.currentLocation || order.origin;
                  const isSelected = selectedOrder?.id === order.id;
                  
                  return (
                    <React.Fragment key={order.id}>
                      <Marker
                        coordinate={{
                          latitude: location.latitude,
                          longitude: location.longitude,
                        }}
                        title={`Order ${order.id}`}
                        description={order.detailsNote || `${order.items.map(i => i.name).join(', ')}`}
                        pinColor={isSelected ? 'red' : 'orange'}
                        onPress={() => {
                          setSelectedOrder(order);
                          const loc = order.currentLocation || order.origin;
                          DeliveryTrackingService.trackDelivery(
                            order.id,
                            { latitude: loc.latitude, longitude: loc.longitude },
                            (orderId) => {
                              Alert.alert(
                                '✅ Arrived!',
                                `You've reached the customer location for order ${orderId}`,
                                [
                                  {
                                    text: 'Mark Delivered',
                                    onPress: () => {
                                      orderService.updateStatus(orderId, 'completed');
                                      setSelectedOrder(null);
                                      DeliveryTrackingService.stopTrackingDelivery(orderId);
                                    },
                                  },
                                  { text: 'Continue', style: 'cancel' },
                                ]
                              );
                            }
                          );
                        }}
                      />
                      
                      {/* Show arrival circle for selected order */}
                      {isSelected && (
                        <Circle
                          center={{
                            latitude: location.latitude,
                            longitude: location.longitude,
                          }}
                          radius={15}
                          fillColor="rgba(255, 59, 48, 0.2)"
                          strokeColor="rgba(255, 59, 48, 0.5)"
                          strokeWidth={2}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </MapView>

              {/* Status Overlay */}
              <View style={styles.statusOverlay}>
                {selectedOrder && deliveryStatus ? (
                  <>
                    <Text style={styles.statusTitle}>Order {selectedOrder.id}</Text>
                    {selectedOrder.detailsNote && (
                      <Text style={styles.statusNote}>📍 {selectedOrder.detailsNote}</Text>
                    )}
                    {/* Floor Information */}
                    {(selectedOrder.origin.floor !== null || selectedOrder.origin.floor !== undefined) && (
                      <Text style={styles.statusNote}>🏢 {formatFloor(selectedOrder.origin.floor ?? 0)}</Text>
                    )}
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Distance:</Text>
                      <Text style={[styles.statusValue, deliveryStatus.distanceToCustomer <= 15 ? styles.statusNear : null]}>
                        {formatDistance(deliveryStatus.distanceToCustomer)}
                        {deliveryStatus.distanceToCustomer <= 15 && ' 🎯'}
                      </Text>
                    </View>
                    {deliveryStatus.hasArrived && (
                      <View style={styles.arrivedBanner}>
                        <Text style={styles.arrivedText}>✅ ARRIVED AT LOCATION!</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.statusTitle}>All Orders ({pending.length})</Text>
                    <Text style={styles.statusNote}>
                      🔴 Red pin = Selected order{'\n'}
                      🟠 Orange pins = Other orders{'\n'}
                      Tap any pin to navigate
                    </Text>
                    <View style={styles.mapTip}>
                      <Text style={styles.mapTipText}>💡 Pinch to zoom • 2 fingers to rotate • Tilt for 3D view</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.mapActions}>
                <TouchableOpacity style={[styles.mapBtn, styles.mapBtnSecondary]} onPress={closeMap}>
                  <Text style={styles.mapBtnTextSecondary}>Close</Text>
                </TouchableOpacity>
                {selectedOrder && (
                  <>
                    <TouchableOpacity 
                      style={[styles.mapBtn, styles.mapBtnAR]} 
                      onPress={switchToARMode}
                    >
                      <Text style={styles.mapBtnText}>📹 AR Mode</Text>
                    </TouchableOpacity>
                    {deliveryStatus && (
                      <TouchableOpacity 
                        style={[styles.mapBtn, styles.mapBtnPrimary, deliveryStatus.hasArrived ? styles.mapBtnSuccess : null]} 
                        onPress={markDelivered}
                      >
                        <Text style={styles.mapBtnText}>
                          {deliveryStatus.hasArrived ? '✅ Delivered' : 'Complete'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* AR Navigation Modal */}
      {showARView && selectedOrder && (
        <Modal visible={showARView} animationType="fade" onRequestClose={closeARView}>
          <ARNavigationView
            targetLatitude={(selectedOrder.currentLocation || selectedOrder.origin).latitude}
            targetLongitude={(selectedOrder.currentLocation || selectedOrder.origin).longitude}
            targetAltitude={(selectedOrder.currentLocation || selectedOrder.origin).altitude ?? undefined}
            targetFloor={(selectedOrder.currentLocation || selectedOrder.origin).floor ?? undefined}
            targetName={`Order ${selectedOrder.id}`}
            onClose={closeARView}
            onArrived={handleARArrival}
          />
        </Modal>
      )}
    </View>
  );
}

// Haversine formula for distance calculation
function calculateDistance(point1: { latitude: number; longitude: number }, point2: { latitude: number; longitude: number }): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 44 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    marginBottom: 8 
  },
  title: { fontSize: 22, fontWeight: '700' },
  viewAllBtn: { 
    backgroundColor: '#34C759', 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 8 
  },
  viewAllText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sep: { height: 8 },
  card: { marginHorizontal: 16, padding: 16, backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  completedCard: { backgroundColor: '#F4F4F5' },
  orderId: { fontWeight: '700', marginBottom: 4 },
  meta: { color: '#3C3C43', marginBottom: 2 },
  items: { marginTop: 8 },
  item: { color: '#1C1C1E' },
  actions: { flexDirection: 'row', marginTop: 12, gap: 12, flexWrap: 'wrap' },
  btn: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ar: { backgroundColor: '#AF52DE' },
  navigate: { backgroundColor: '#34C759' },
  ping: { backgroundColor: '#FF9500' },
  secondary: { backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  secondaryText: { color: '#1C1C1E' },
  note: { marginTop: 8, color: '#1C1C1E' },
  subTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    backgroundColor: '#F2F2F7',
    borderTopWidth: 1,
    borderTopColor: '#C7C7CC',
  },
  completedToggleHint: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  empty: { color: '#8E8E93', paddingHorizontal: 16, paddingVertical: 12 },
  sortContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  sortBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  sortActive: { backgroundColor: '#007AFF' },
  sortText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  sortTextActive: { color: '#FFFFFF' },
  calibrateBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#FF9500', borderWidth: 1, borderColor: '#FF9500' },
  calibrateText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  // Map Modal Styles
  mapContainer: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  statusOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  statusTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#1C1C1E' },
  statusNote: { fontSize: 14, color: '#3C3C43', marginBottom: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statusLabel: { fontSize: 16, fontWeight: '600', color: '#3C3C43' },
  statusValue: { fontSize: 18, fontWeight: '700', color: '#007AFF' },
  statusNear: { color: '#34C759' },
  arrivedBanner: {
    marginTop: 12,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  arrivedText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  mapTip: {
    marginTop: 12,
    backgroundColor: '#F2F2F7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  mapTipText: { fontSize: 12, color: '#3C3C43', textAlign: 'center', lineHeight: 16 },
  mapActions: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  mapBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnPrimary: { backgroundColor: '#007AFF' },
  mapBtnSuccess: { backgroundColor: '#34C759' },
  mapBtnAR: { backgroundColor: '#AF52DE' },
  mapBtnSecondary: { backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  mapBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  mapBtnTextSecondary: { color: '#1C1C1E', fontSize: 16, fontWeight: '700' },
});


