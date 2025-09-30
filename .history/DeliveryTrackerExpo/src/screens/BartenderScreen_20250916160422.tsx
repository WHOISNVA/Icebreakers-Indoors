import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
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

  useEffect(() => {
    return orderService.subscribe(setOrders);
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

  const openDirections = (o: Order) => {
    // Use current location if available, otherwise use origin
    const location = o.currentLocation || o.origin;
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
    <View style={styles.card}>
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
        <TouchableOpacity style={styles.btn} onPress={() => openDirections(item)}>
          <Text style={styles.btnText}>
            {item.currentLocation ? 'Directions (Updated)' : 'Directions'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => orderService.updateStatus(item.id, 'completed')}>
          <Text style={[styles.btnText, styles.secondaryText]}>Mark Completed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incoming Orders</Text>
      
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
      
      <FlatList data={pending} keyExtractor={o => o.id} renderItem={renderOrder} ItemSeparatorComponent={() => <View style={styles.sep} />} ListEmptyComponent={<Text style={styles.empty}>No active orders</Text>} />

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
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 44 },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  sep: { height: 8 },
  card: { marginHorizontal: 16, padding: 16, backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  completedCard: { backgroundColor: '#F4F4F5' },
  orderId: { fontWeight: '700', marginBottom: 4 },
  meta: { color: '#3C3C43', marginBottom: 2 },
  items: { marginTop: 8 },
  item: { color: '#1C1C1E' },
  actions: { flexDirection: 'row', marginTop: 12, gap: 12 },
  btn: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  secondaryText: { color: '#1C1C1E' },
  note: { marginTop: 8, color: '#1C1C1E' },
  subTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  empty: { color: '#8E8E93', paddingHorizontal: 16, paddingVertical: 12 },
  sortContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  sortBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  sortActive: { backgroundColor: '#007AFF' },
  sortText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  sortTextActive: { color: '#FFFFFF' },
});


