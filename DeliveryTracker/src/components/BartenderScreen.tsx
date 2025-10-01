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
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import LiveLocationService, { LiveLocationData } from '../services/LiveLocationService';
import PingService, { PingData } from '../services/PingService';
import { formatLocation, formatDistance } from '../utils/locationUtils';

const { width, height } = Dimensions.get('window');

const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

interface Order {
  id: string;
  customerName: string;
  orderItems: string[];
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  liveLocation?: LiveLocationData;
  lastPing?: PingData;
}

const BartenderScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Initialize with sample orders
    const sampleOrders: Order[] = [
      {
        id: 'delivery-001',
        customerName: 'John Doe',
        orderItems: ['Margarita', 'Caesar Salad'],
        status: 'preparing',
      },
      {
        id: 'delivery-002',
        customerName: 'Jane Smith',
        orderItems: ['Beer', 'Wings'],
        status: 'ready',
      },
    ];

    setOrders(sampleOrders);
    setSelectedOrder(sampleOrders[0]);

    // Set up ping service for bartender
    PingService.setCurrentUserId('bartender-456');

    // Subscribe to live locations for all orders
    sampleOrders.forEach(order => {
      LiveLocationService.subscribeToLiveLocation(
        order.id,
        (location: LiveLocationData) => {
          setOrders(prev => prev.map(o => 
            o.id === order.id 
              ? { ...o, liveLocation: location }
              : o
          ));
          
          // Update map region if this is the selected order
          if (selectedOrder?.id === order.id) {
            setMapRegion({
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            });
          }
        },
        (error) => {
          console.error('Live location subscription error:', error);
        }
      );

      // Subscribe to ping notifications
      PingService.subscribeToPings(
        order.id,
        (ping: PingData) => {
          setOrders(prev => prev.map(o => 
            o.id === order.id 
              ? { ...o, lastPing: ping }
              : o
          ));
          
          Alert.alert(
            'Ping Received!',
            `${ping.message}\nFrom: ${ping.fromUserId}\nOrder: ${order.customerName}`,
            [
              {
                text: 'View Location',
                onPress: () => {
                  setSelectedOrder(orders.find(o => o.id === order.id) || null);
                },
              },
              { text: 'Dismiss' },
            ]
          );
        },
        (error) => {
          console.error('Ping subscription error:', error);
        }
      );
    });

    return () => {
      // Cleanup subscriptions
      sampleOrders.forEach(order => {
        LiveLocationService.unsubscribeFromLiveLocation(order.id);
        PingService.unsubscribeFromPings(order.id);
      });
    };
  }, []);

  const sendPingToCustomer = async (orderId: string) => {
    try {
      const success = await PingService.sendPing(
        orderId,
        'user-123', // Customer user ID
        'Your order is ready! I\'m on my way to deliver it.'
      );

      if (success) {
        Alert.alert('Ping Sent', 'The customer has been notified.');
      } else {
        Alert.alert('Error', 'Failed to send ping.');
      }
    } catch (error) {
      console.error('Send ping error:', error);
      Alert.alert('Error', 'Failed to send ping.');
    }
  };

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus }
        : order
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'preparing': return '#007AFF';
      case 'ready': return '#34C759';
      case 'delivered': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'delivered': return 'Delivered';
      default: return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bartender Dashboard</Text>
        <Text style={styles.headerSubtitle}>Live Order Tracking</Text>
      </View>

      {/* Orders List */}
      <ScrollView style={styles.ordersList} horizontal showsHorizontalScrollIndicator={false}>
        {orders.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={[
              styles.orderCard,
              selectedOrder?.id === order.id && styles.selectedOrderCard
            ]}
            onPress={() => setSelectedOrder(order)}
          >
            <Text style={styles.customerName}>{order.customerName}</Text>
            <Text style={styles.orderId}>#{order.id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
              <Text style={styles.statusText}>
                {getStatusText(order.status)}
              </Text>
            </View>
            {order.liveLocation && (
              <View style={styles.locationStatus}>
                <Text style={styles.locationStatusText}>📍 Live Location</Text>
                <Text style={styles.locationStatusText}>
                  {formatDistance(order.liveLocation.accuracy)} accuracy
                </Text>
              </View>
            )}
            {order.lastPing && (
              <View style={styles.pingStatus}>
                <Text style={styles.pingStatusText}>🔔 Pinged {new Date(order.lastPing.timestamp).toLocaleTimeString()}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          mapType="standard"
        >
          {selectedOrder?.liveLocation && (
            <Marker
              coordinate={{
                latitude: selectedOrder.liveLocation.latitude,
                longitude: selectedOrder.liveLocation.longitude,
              }}
              title={`${selectedOrder.customerName} - Live Location`}
              description={`Accuracy: ${selectedOrder.liveLocation.accuracy.toFixed(0)}m`}
              pinColor="#007AFF"
            />
          )}
        </MapView>
      </View>

      {/* Order Details */}
      {selectedOrder && (
        <View style={styles.orderDetails}>
          <Text style={styles.orderDetailsTitle}>Order Details</Text>
          <Text style={styles.customerName}>{selectedOrder.customerName}</Text>
          <Text style={styles.orderItems}>
            {selectedOrder.orderItems.join(', ')}
          </Text>
          
          {selectedOrder.liveLocation && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationInfoTitle}>Live Location:</Text>
              <Text style={styles.locationText}>
                {formatLocation(selectedOrder.liveLocation)}
              </Text>
              <Text style={styles.locationText}>
                Accuracy: {formatDistance(selectedOrder.liveLocation.accuracy)}
              </Text>
              <Text style={styles.locationText}>
                Last Updated: {new Date(selectedOrder.liveLocation.lastUpdated).toLocaleTimeString()}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.pingButton]}
              onPress={() => sendPingToCustomer(selectedOrder.id)}
            >
              <Text style={styles.actionButtonText}>🔔 Ping Customer</Text>
            </TouchableOpacity>
            
            {selectedOrder.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.readyButton]}
                onPress={() => updateOrderStatus(selectedOrder.id, 'ready')}
              >
                <Text style={styles.actionButtonText}>Mark Ready</Text>
              </TouchableOpacity>
            )}
            
            {selectedOrder.status === 'ready' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deliveredButton]}
                onPress={() => updateOrderStatus(selectedOrder.id, 'delivered')}
              >
                <Text style={styles.actionButtonText}>Mark Delivered</Text>
              </TouchableOpacity>
            )}
          </View>
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
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  ordersList: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginRight: 15,
    borderRadius: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedOrderCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  locationStatus: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  locationStatusText: {
    fontSize: 12,
    color: '#1976D2',
    textAlign: 'center',
  },
  pingStatus: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 8,
  },
  pingStatusText: {
    fontSize: 12,
    color: '#F57C00',
    textAlign: 'center',
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
  orderDetails: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  orderItems: {
    fontSize: 14,
    color: '#3C3C43',
    marginBottom: 15,
  },
  locationInfo: {
    backgroundColor: '#F2F2F7',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  locationInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pingButton: {
    backgroundColor: '#FF9500',
  },
  readyButton: {
    backgroundColor: '#34C759',
  },
  deliveredButton: {
    backgroundColor: '#8E8E93',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BartenderScreen;






