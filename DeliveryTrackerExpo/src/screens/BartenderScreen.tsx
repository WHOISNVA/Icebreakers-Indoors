import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { orderService } from '../services/OrderService';
import { Order } from '../types/order';
import MapModal from '../components/MapModal';

export default function BartenderScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mapVisible, setMapVisible] = useState(false);

  useEffect(() => {
    return orderService.subscribe(setOrders);
  }, []);

  const openMap = (order: Order) => {
    setSelectedOrder(order);
    setMapVisible(true);
  };

  const closeMap = () => {
    setMapVisible(false);
    setSelectedOrder(null);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'in_progress': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>Order #{item.id.slice(-6)}</Text>
          <Text style={styles.orderTime}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
        </View>
      </View>
      
      {item.locationDescription && (
        <View style={styles.locationCard}>
          <Text style={styles.locationIcon}>📍</Text>
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Customer Location</Text>
            <Text style={styles.locationDesc}>{item.locationDescription}</Text>
          </View>
        </View>
      )}
      
      {item.currentLocationDescription && (
        <View style={[styles.locationCard, styles.updatedLocationCard]}>
          <Text style={styles.locationIcon}>📍</Text>
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Updated Location</Text>
            <Text style={styles.locationDesc}>{item.currentLocationDescription}</Text>
          </View>
        </View>
      )}
      
      <View style={styles.itemsContainer}>
        <Text style={styles.itemsTitle}>Order Items</Text>
        {item.items.map(it => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{it.name}</Text>
            <Text style={styles.itemQuantity}>×{it.quantity}</Text>
          </View>
        ))}
      </View>

      <View style={styles.gpsInfo}>
        <Text style={styles.gpsText}>
          GPS: {item.origin.latitude.toFixed(4)}, {item.origin.longitude.toFixed(4)}
          {item.origin.accuracy ? ` (±${Math.round(item.origin.accuracy)}m)` : ''}
        </Text>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity style={styles.mapButton} onPress={() => openMap(item)}>
          <Text style={styles.mapButtonText}>🗺️ View Map</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.completeButton, item.status === 'completed' && styles.completedButton]} 
          onPress={() => orderService.updateStatus(item.id, 'completed')}
          disabled={item.status === 'completed'}
        >
          <Text style={[styles.completeButtonText, item.status === 'completed' && styles.completedButtonText]}>
            {item.status === 'completed' ? '✓ Completed' : 'Complete Order'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const pendingOrders = orders.filter(o => o.status !== 'completed');
  const completedOrders = orders.filter(o => o.status === 'completed');

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>
          {pendingOrders.length} active • {completedOrders.length} completed
        </Text>
      </View>

      {pendingOrders.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Orders</Text>
          {pendingOrders.map(order => (
            <View key={order.id}>
              {renderOrder({ item: order })}
            </View>
          ))}
        </View>
      )}

      {completedOrders.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed Orders</Text>
          {completedOrders.map(order => (
            <View key={order.id}>
              {renderOrder({ item: order })}
            </View>
          ))}
        </View>
      )}

      {orders.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>New orders will appear here</Text>
        </View>
      )}

      <MapModal
        visible={mapVisible}
        order={selectedOrder}
        onClose={closeMap}
        onComplete={() => {
          if (selectedOrder) {
            orderService.updateStatus(selectedOrder.id, 'completed');
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#1a1a2e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  card: { 
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderId: { 
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  orderTime: {
    fontSize: 14,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  locationCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  updatedLocationCard: {
    backgroundColor: '#f0fdf4',
  },
  locationIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationDesc: {
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '500',
    lineHeight: 22,
  },
  itemsContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: { 
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  gpsInfo: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  gpsText: { 
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: { 
    flexDirection: 'row',
    gap: 12,
  },
  mapButton: { 
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  mapButtonText: { 
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: { 
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  completedButton: {
    backgroundColor: '#10b981',
  },
  completeButtonText: { 
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  completedButtonText: {
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
  },
});


