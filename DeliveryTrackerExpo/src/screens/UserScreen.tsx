import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList } from 'react-native';
import { orderService } from '../services/OrderService';
import { OrderItem } from '../types/order';

const MENU: Array<{ id: string; name: string }> = [
  { id: 'beer', name: 'Beer' },
  { id: 'wine', name: 'Wine' },
  { id: 'cocktail', name: 'Cocktail' },
  { id: 'water', name: 'Water' },
];

export default function UserScreen() {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  const items: OrderItem[] = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ id, name: MENU.find(m => m.id === id)?.name || id, quantity })),
    [selected]
  );

  const adjust = (id: string, delta: number) => {
    setSelected(prev => {
      const next = { ...prev };
      const val = (next[id] || 0) + delta;
      if (val <= 0) delete next[id]; else next[id] = val;
      return next;
    });
  };

  const submit = async () => {
    if (items.length === 0) {
      Alert.alert('No items', 'Please add at least one item.');
      return;
    }
    try {
      const order = await orderService.createOrder(items);
      Alert.alert('Order placed', `Order ${order.id} created.`);
      setSelected({});
      setLastOrderId(order.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create order');
    }
  };

  const updateLocation = async () => {
    const targetId = lastOrderId || orderService.getLastOrderId();
    if (!targetId) {
      Alert.alert('No order', 'Place an order first to update its location.');
      return;
    }
    try {
      await orderService.updateOrderLocation(targetId);
      Alert.alert('Updated', 'Your current location was shared with the bar.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update location');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Menu</Text>
      <FlatList
        data={MENU}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => adjust(item.id, -1)}>
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qty}>{selected[item.id] || 0}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => adjust(item.id, 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />

      <TouchableOpacity style={styles.submit} onPress={submit}>
        <Text style={styles.submitText}>Submit Order</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.submit, styles.secondary]} onPress={updateLocation}>
        <Text style={styles.submitText}>Update Location For Last Order</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 44 },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  itemName: { fontSize: 16, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 20, fontWeight: '700' },
  qty: { width: 32, textAlign: 'center', fontSize: 16 },
  sep: { height: 1, backgroundColor: '#eee' },
  submit: { margin: 16, backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { backgroundColor: '#5856D6' },
});


