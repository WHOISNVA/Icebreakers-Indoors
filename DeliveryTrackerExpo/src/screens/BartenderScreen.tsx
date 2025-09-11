import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import { orderService } from '../services/OrderService';
import { Order } from '../types/order';

function mapsUrl(lat: number, lng: number): string {
  const q = `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function BartenderScreen() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    return orderService.subscribe(setOrders);
  }, []);

  const openDirections = (o: Order) => {
    Linking.openURL(mapsUrl(o.origin.latitude, o.origin.longitude)).catch(() => {});
  };

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
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={() => openDirections(item)}>
          <Text style={styles.btnText}>Directions</Text>
        </TouchableOpacity>
        {item.currentLocation && (
          <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(mapsUrl(item.currentLocation!.latitude, item.currentLocation!.longitude)).catch(() => {})}>
            <Text style={styles.btnText}>Current</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => orderService.updateStatus(item.id, 'completed')}>
          <Text style={[styles.btnText, styles.secondaryText]}>Complete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incoming Orders</Text>
      <FlatList data={orders} keyExtractor={o => o.id} renderItem={renderOrder} ItemSeparatorComponent={() => <View style={styles.sep} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 44 },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  sep: { height: 8 },
  card: { marginHorizontal: 16, padding: 16, backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  orderId: { fontWeight: '700', marginBottom: 4 },
  meta: { color: '#3C3C43', marginBottom: 2 },
  items: { marginTop: 8 },
  item: { color: '#1C1C1E' },
  actions: { flexDirection: 'row', marginTop: 12, gap: 12 },
  btn: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  secondaryText: { color: '#1C1C1E' },
});


