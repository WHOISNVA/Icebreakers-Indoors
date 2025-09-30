import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
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
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationDescription, setLocationDescription] = useState('');
  const [pendingAction, setPendingAction] = useState<'order' | 'update' | null>(null);

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

  const promptForLocation = (action: 'order' | 'update') => {
    setPendingAction(action);
    setLocationDescription('');
    setShowLocationModal(true);
  };

  const handleLocationSubmit = async () => {
    if (!locationDescription.trim()) {
      Alert.alert('Description Required', 'Please describe your location (e.g., "Near the pool table", "By the main entrance")');
      return;
    }

    setShowLocationModal(false);

    try {
      if (pendingAction === 'order') {
        const order = await orderService.createOrder(items, locationDescription);
        Alert.alert('Order placed', `Order ${order.id} created at: ${locationDescription}`);
        setSelected({});
        setLastOrderId(order.id);
      } else if (pendingAction === 'update') {
        const targetId = lastOrderId || orderService.getLastOrderId();
        if (!targetId) {
          Alert.alert('No order', 'Place an order first to update its location.');
          return;
        }
        await orderService.updateOrderLocation(targetId, locationDescription);
        Alert.alert('Updated', `Your location "${locationDescription}" was shared with the bar.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to complete action');
    }

    setPendingAction(null);
    setLocationDescription('');
  };

  const submit = () => {
    if (items.length === 0) {
      Alert.alert('No items', 'Please add at least one item.');
      return;
    }
    promptForLocation('order');
  };

  const updateLocation = () => {
    promptForLocation('update');
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

      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Where are you located?</Text>
            <Text style={styles.modalSubtitle}>
              Help the bartender find you by describing your location
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="e.g., Near the pool table, By the main entrance, Red booth in the corner"
              placeholderTextColor="#8E8E93"
              value={locationDescription}
              onChangeText={setLocationDescription}
              multiline
              numberOfLines={3}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowLocationModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={handleLocationSubmit}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: '#1C1C1E',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
    color: '#1C1C1E',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#C7C7CC',
  },
  cancelButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});


