import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, RefreshControl, Modal, Switch, TextInput } from 'react-native';
import { orderService } from '../services/OrderService';
import { Order } from '../types/order';
import * as Location from 'expo-location';

function mapsUrl(lat: number, lng: number): string {
  const q = `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

type SortOption = 'timestamp' | 'proximity';

export default function BartenderScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('timestamp');
  const [barLocation, setBarLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [shipModeEnabled, setShipModeEnabled] = useState(false);
  const [shipName, setShipName] = useState('');
  const [deckCount, setDeckCount] = useState('12');

  useEffect(() => {
    return orderService.subscribe((newOrders) => {
      console.log('Orders updated:', newOrders.length);
      newOrders.forEach(order => {
        if (order.currentLocation) {
          console.log(`Order ${order.id} has current location:`, order.currentLocation);
        }
      });
      setOrders(newOrders);
    });
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

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Force a re-subscription to get latest data
    console.log('Manual refresh triggered');
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const openDirections = (o: Order) => {
    // Use current location if available, otherwise use origin
    const location = o.currentLocation || o.origin;
    console.log('Opening directions for order:', o.id);
    console.log('Using location:', location);
    console.log('Current location available:', !!o.currentLocation);
    Linking.openURL(mapsUrl(location.latitude, location.longitude)).catch(() => {});
  };

  const pending = useMemo(() => {
    let filtered = orders.filter(o => o.status !== 'completed');
    
    if (sortBy === 'timestamp') {
      return filtered.sort((a, b) => b.createdAt - a.createdAt); // newest first
    } else if (sortBy === 'proximity' && barLocation) {
      return filtered.sort((a, b) => {
        // Use current location if available, otherwise use origin
        const locationA = a.currentLocation || a.origin;
        const locationB = b.currentLocation || b.origin;
        const distA = calculateDistance(barLocation, locationA);
        const distB = calculateDistance(barLocation, locationB);
        return distA - distB; // closest first
      });
    }
    
    return filtered;
  }, [orders, sortBy, barLocation]);
  const completed = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.card} key={`${item.id}-${item.currentLocation?.timestamp || 'origin'}`}>
      <Text style={styles.orderId}>Order {item.id}</Text>
      <Text style={styles.meta}>Time: {new Date(item.createdAt).toLocaleTimeString()}</Text>
      <Text style={styles.meta}>
        From: {item.origin.latitude.toFixed(6)}, {item.origin.longitude.toFixed(6)}
        {item.origin.accuracy ? ` (±${Math.round(item.origin.accuracy)}m)` : ''}
      </Text>
      {item.currentLocation && (
        <Text style={styles.meta}>
          Current: {item.currentLocation.latitude.toFixed(6)}, {item.currentLocation.longitude.toFixed(6)}
          {item.currentLocation.accuracy ? ` (±${Math.round(item.currentLocation.accuracy)}m)` : ''}
          {item.currentLocation.timestamp && ` @ ${new Date(item.currentLocation.timestamp).toLocaleTimeString()}`}
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
      
      {/* Routing Information */}
      {item.assignedBarName && (
        <Text style={styles.assignedBar}>
          🏪 Assigned to: {item.assignedBarName}
        </Text>
      )}
      {item.routingReason && (
        <Text style={styles.routingReason}>
          🎯 {item.routingReason}
        </Text>
      )}
      {item.estimatedDeliveryTime && (
        <Text style={styles.deliveryTime}>
          ⏱️ Est. delivery: {Math.round(item.estimatedDeliveryTime / 60)}min
        </Text>
      )}
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.btn} 
          onPress={() => openDirections(item)}
          key={`btn-${item.id}-${item.currentLocation?.timestamp || 'origin'}`}
        >
          <Text style={styles.btnText}>
            {item.currentLocation ? 'Directions (Updated)' : 'Directions'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => orderService.completeOrder(item.id)}>
          <Text style={[styles.btnText, styles.secondaryText]}>Mark Completed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Incoming Orders</Text>
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsVisible}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>Cruise Ship Mode</Text>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Enable Ship Mode</Text>
                <Switch
                  value={shipModeEnabled}
                  onValueChange={setShipModeEnabled}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                  thumbColor={shipModeEnabled ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              {shipModeEnabled && (
                <>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Ship Name</Text>
                    <TextInput
                      style={styles.input}
                      value={shipName}
                      onChangeText={setShipName}
                      placeholder="Enter ship name"
                      placeholderTextColor="#8E8E93"
                    />
                  </View>
                  
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Deck Count</Text>
                    <TextInput
                      style={styles.input}
                      value={deckCount}
                      onChangeText={setDeckCount}
                      placeholder="Number of decks"
                      keyboardType="numeric"
                      placeholderTextColor="#8E8E93"
                    />
                  </View>
                  
                  <Text style={styles.infoText}>
                    Ship mode enables:{'\n'}• Sea level elevation tracking{'\n'}• Deck-based positioning{'\n'}• Ship motion compensation{'\n'}• Maritime-specific accuracy
                  </Text>
                </>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={() => {
                // Save settings logic here
                setSettingsVisible(false);
              }}
            >
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
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
      </View>
      
      <FlatList 
        data={pending} 
        keyExtractor={o => o.id} 
        renderItem={renderOrder} 
        ItemSeparatorComponent={() => <View style={styles.sep} />} 
        ListEmptyComponent={<Text style={styles.empty}>No active orders</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {completed.length > 0 && (
        <>
          <Text style={styles.subTitle}>Completed</Text>
          <FlatList data={completed} keyExtractor={o => o.id} renderItem={({ item }) => (
            <View style={[styles.card, styles.completedCard]}>
              <Text style={styles.orderId}>Order {item.id}</Text>
              <Text style={styles.meta}>Completed</Text>
              {item.currentLocation && (
                <Text style={styles.meta}>
                  Last Known: {item.currentLocation.latitude.toFixed(6)}, {item.currentLocation.longitude.toFixed(6)}
                </Text>
              )}
              {item.detailsNote ? (
                <Text style={styles.note}>Note: {item.detailsNote}</Text>
              ) : null}
            </View>
          )} ItemSeparatorComponent={() => <View style={styles.sep} />} />
        </>
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
  container: { flex: 1, backgroundColor: '#fff' }, // Remove paddingTop from here
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1C1C1E' },
  settingsButton: { padding: 8 },
  settingsIcon: { fontSize: 24, color: '#1C1C1E' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  closeButton: { fontSize: 24, color: '#1C1C1E' },
  settingsSection: { width: '100%', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: { fontSize: 16, color: '#1C1C1E' },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'left',
    marginTop: 12,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  sortContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  sortBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  sortActive: { backgroundColor: '#007AFF' },
  sortText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  sortTextActive: { color: '#FFFFFF' },
  sep: { height: 8 },
  card: { marginHorizontal: 16, padding: 16, backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  completedCard: { backgroundColor: '#F4F4F5' },
  orderId: { fontWeight: '700', marginBottom: 4 },
  meta: { color: '#3C3C43', marginBottom: 2 },
  items: { marginTop: 8 },
  item: { color: '#1C1C1E' },
  assignedBar: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginTop: 6,
  },
  routingReason: {
    fontSize: 13,
    color: '#1976D2',
    marginTop: 4,
  },
  deliveryTime: {
    fontSize: 13,
    color: '#F57C00',
    fontWeight: '500',
    marginTop: 4,
  },
  actions: { flexDirection: 'row', marginTop: 12, gap: 12 },
  btn: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  secondaryText: { color: '#1C1C1E' },
  note: { marginTop: 8, color: '#1C1C1E' },
  subTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  empty: { color: '#8E8E93', paddingHorizontal: 16, paddingVertical: 12 },
});


