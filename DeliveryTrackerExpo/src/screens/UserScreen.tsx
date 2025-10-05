import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, TextInput, Modal } from 'react-native';
import { orderService } from '../services/OrderService';
import { OrderItem } from '../types/order';
import PingService from '../services/PingService';

const MENU: Array<{ id: string; name: string }> = [
  { id: 'beer', name: 'Beer' },
  { id: 'wine', name: 'Wine' },
  { id: 'cocktail', name: 'Cocktail' },
  { id: 'water', name: 'Water' },
];

export default function UserScreen() {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [details, setDetails] = useState<string>('');
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  // Set user ID and subscribe to pings
  useEffect(() => {
    console.log('🔔 UserScreen: Setting up PingService for user-123');
    PingService.setCurrentUserId('user-123');

    // Subscribe to pings for the last order
    if (lastOrderId) {
      console.log(`🔔 UserScreen: Subscribing to pings for order: ${lastOrderId}`);
      PingService.subscribeToPings(
        lastOrderId,
        (ping) => {
          console.log('🔔 UserScreen: Ping received!', ping);
          Alert.alert('Ping Debug', `Received ping from ${ping.fromUserId} for order ${ping.orderId}`);
        },
        (error) => {
          console.error('🔔 UserScreen: Ping subscription error:', error);
        }
      );

      return () => {
        console.log(`🔔 UserScreen: Unsubscribing from pings for order: ${lastOrderId}`);
        PingService.unsubscribeFromPings(lastOrderId);
      };
    } else {
      console.log('🔔 UserScreen: No lastOrderId yet, waiting for order...');
    }
  }, [lastOrderId]);

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
      // Order creation now automatically detects floor from altitude
      const order = await orderService.createOrder(items);
      Alert.alert('Order placed', `Order ${order.id} created.`);
      setSelected({});
      setLastOrderId(order.id);
      setDetails('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create order');
    }
  };

  const updateLocation = async () => {
    Alert.alert(
      'Are you inside a room?',
      'If yes, you can add details like room number, floor, or area.',
      [
        { text: 'No', style: 'cancel', onPress: async () => { await performUpdate(''); } },
        { text: 'Yes', onPress: () => setShowDetailsModal(true) },
      ]
    );
  };

  const performUpdate = async (note: string) => {
    const targetId = lastOrderId || orderService.getLastOrderId();
    if (!targetId) {
      Alert.alert('No order', 'Place an order first to update its location.');
      return;
    }
    try {
      await orderService.updateOrderLocation(targetId, note || null);
      Alert.alert('Updated', note ? 'Your current location and details were shared with the bar.' : 'Your current location was shared with the bar.');
      setShowDetailsModal(false);
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
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity style={styles.submit} onPress={submit}>
        <Text style={styles.submitText}>Submit Order</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.submit, styles.secondary]} onPress={updateLocation}>
        <Text style={styles.submitText}>Update Delivery Location</Text>
      </TouchableOpacity>

      <Modal
        transparent
        visible={showDetailsModal}
        animationType="fade"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Where are you exactly?</Text>
            <Text style={styles.noteLabel}>Details (room, floor, area):</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Tower B, Floor 12, Room 1208 near elevators"
              value={details}
              onChangeText={setDetails}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowDetailsModal(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalPrimary]} onPress={() => performUpdate(details)}>
                <Text style={styles.modalBtnText}>Update Delivery Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 44, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  itemName: { fontSize: 16, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 20, fontWeight: '700' },
  qty: { width: 32, textAlign: 'center', fontSize: 16 },
  sep: { height: 1, backgroundColor: '#eee' },
  submit: { marginHorizontal: 16, marginTop: 16, marginBottom: 12, backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { backgroundColor: '#5856D6' },
  noteBlock: { marginTop: 10, marginHorizontal: 16, gap: 8 },
  noteLabel: { fontSize: 14, color: '#3C3C43' },
  input: { minHeight: 60, borderWidth: 1, borderColor: '#C7C7CC', borderRadius: 10, padding: 10, backgroundColor: '#fff', textAlignVertical: 'top' },
  listContent: { paddingBottom: 160 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#1C1C1E' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  modalBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10 },
  modalPrimary: { backgroundColor: '#007AFF' },
  modalCancel: { backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#C7C7CC' },
  modalBtnText: { color: '#fff', fontWeight: '700' },
  modalBtnTextCancel: { color: '#1C1C1E', fontWeight: '700' },
});


