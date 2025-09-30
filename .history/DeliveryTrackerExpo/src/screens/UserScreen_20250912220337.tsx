import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { orderService } from '../services/OrderService';
import { OrderItem } from '../types/order';

interface MenuItem {
  id: string;
  name: string;
  price: string;
  description?: string;
}

interface MenuCategory {
  id: string;
  name: string;
  emoji: string;
  items: MenuItem[];
}

const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: 'beer',
    name: 'Beer',
    emoji: '🍺',
    items: [
      { id: 'beer-lager', name: 'House Lager', price: '$5', description: 'Light & crisp' },
      { id: 'beer-ipa', name: 'IPA', price: '$7', description: 'Hoppy & bold' },
      { id: 'beer-stout', name: 'Stout', price: '$7', description: 'Rich & creamy' },
      { id: 'beer-wheat', name: 'Wheat Beer', price: '$6', description: 'Smooth & citrusy' },
      { id: 'beer-pale', name: 'Pale Ale', price: '$6', description: 'Balanced & refreshing' },
    ]
  },
  {
    id: 'wine',
    name: 'Wine',
    emoji: '🍷',
    items: [
      { id: 'wine-cab', name: 'Cabernet Sauvignon', price: '$9', description: 'Full-bodied red' },
      { id: 'wine-pinot', name: 'Pinot Noir', price: '$10', description: 'Light red' },
      { id: 'wine-chard', name: 'Chardonnay', price: '$8', description: 'Crisp white' },
      { id: 'wine-sauv', name: 'Sauvignon Blanc', price: '$8', description: 'Zesty white' },
      { id: 'wine-rose', name: 'Rosé', price: '$9', description: 'Refreshing pink' },
    ]
  },
  {
    id: 'cocktails',
    name: 'Cocktails',
    emoji: '🍹',
    items: [
      { id: 'cocktail-margarita', name: 'Margarita', price: '$10', description: 'Tequila, lime, triple sec' },
      { id: 'cocktail-oldFashioned', name: 'Old Fashioned', price: '$12', description: 'Bourbon, bitters, sugar' },
      { id: 'cocktail-mojito', name: 'Mojito', price: '$10', description: 'Rum, mint, lime' },
      { id: 'cocktail-martini', name: 'Martini', price: '$11', description: 'Gin or vodka, vermouth' },
      { id: 'cocktail-cosmo', name: 'Cosmopolitan', price: '$11', description: 'Vodka, cranberry, lime' },
    ]
  },
  {
    id: 'nonalcoholic',
    name: 'Non-Alcoholic',
    emoji: '🥤',
    items: [
      { id: 'na-water', name: 'Water', price: '$0', description: 'Still or sparkling' },
      { id: 'na-soda', name: 'Soft Drinks', price: '$3', description: 'Coke, Sprite, etc.' },
      { id: 'na-juice', name: 'Fresh Juice', price: '$4', description: 'Orange, apple, cranberry' },
      { id: 'na-coffee', name: 'Coffee', price: '$3', description: 'Hot or iced' },
      { id: 'na-tea', name: 'Tea', price: '$3', description: 'Various flavors' },
    ]
  }
];

export default function UserScreen() {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationDescription, setLocationDescription] = useState('');
  const [pendingAction, setPendingAction] = useState<'order' | 'update' | null>(null);

  const items: OrderItem[] = useMemo(() => {
    const orderItems: OrderItem[] = [];
    Object.entries(selected).forEach(([itemId, quantity]) => {
      if (quantity > 0) {
        // Find the item in categories
        for (const category of MENU_CATEGORIES) {
          const item = category.items.find(i => i.id === itemId);
          if (item) {
            orderItems.push({ id: itemId, name: item.name, quantity });
            break;
          }
        }
      }
    });
    return orderItems;
  }, [selected]);

  const totalItems = useMemo(
    () => Object.values(selected).reduce((sum, qty) => sum + qty, 0),
    [selected]
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

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

  const renderMenuItem = (item: MenuItem, categoryId: string) => (
    <View key={item.id} style={styles.menuItem}>
      <View style={styles.itemInfo}>
        <View>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.itemDescription}>{item.description}</Text>
          )}
        </View>
        <Text style={styles.itemPrice}>{item.price}</Text>
      </View>
      <View style={styles.qtyControls}>
        <TouchableOpacity 
          style={[styles.qtyBtn, selected[item.id] === 0 && styles.qtyBtnDisabled]} 
          onPress={() => adjust(item.id, -1)}
          disabled={!selected[item.id]}
        >
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.qtyDisplay}>
          <Text style={styles.qtyText}>{selected[item.id] || 0}</Text>
        </View>
        <TouchableOpacity 
          style={styles.qtyBtn} 
          onPress={() => adjust(item.id, 1)}
        >
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Menu</Text>
          <Text style={styles.subtitle}>Tap categories to explore</Text>
        </View>

        <View style={styles.categoriesContainer}>
          {MENU_CATEGORIES.map((category, index) => (
            <View key={category.id} style={styles.categorySection}>
              <TouchableOpacity 
                style={styles.categoryHeader}
                onPress={() => toggleCategory(category.id)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryLeft}>
                  <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  {selected && Object.entries(selected).some(([id, qty]) => 
                    qty > 0 && category.items.some(item => item.id === id)
                  ) && (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {Object.entries(selected).reduce((sum, [id, qty]) => 
                          category.items.some(item => item.id === id) ? sum + qty : sum, 0
                        )}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.expandIcon}>
                  {expandedCategories[category.id] ? '−' : '+'}
                </Text>
              </TouchableOpacity>
              
              {expandedCategories[category.id] && (
                <View style={styles.itemsContainer}>
                  {category.items.map(item => renderMenuItem(item, category.id))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
        {totalItems > 0 && (
          <View style={styles.cartSummary}>
            <Text style={styles.cartText}>
              {totalItems} {totalItems === 1 ? 'item' : 'items'} in cart
            </Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={[styles.submitButton, totalItems === 0 && styles.submitButtonDisabled]} 
          onPress={submit}
          disabled={totalItems === 0}
        >
          <Text style={styles.submitButtonText}>Place Order</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.updateButton} onPress={updateLocation}>
          <Text style={styles.updateButtonText}>📍 Update My Location</Text>
        </TouchableOpacity>
      </View>

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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📍 Where are you?</Text>
              <Text style={styles.modalSubtitle}>
                Help the bartender find you quickly
              </Text>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="e.g., Near the pool table, By the main entrance, Red booth in the corner"
              placeholderTextColor="#94a3b8"
              value={locationDescription}
              onChangeText={setLocationDescription}
              multiline
              numberOfLines={3}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowLocationModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton} 
                onPress={handleLocationSubmit}
              >
                <Text style={styles.confirmButtonText}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
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
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  categorySection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  categoryBadge: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  expandIcon: {
    fontSize: 24,
    color: '#64748b',
    fontWeight: '600',
  },
  itemsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 16,
  },
  itemName: { 
    fontSize: 16, 
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  itemPrice: {
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '700',
    marginLeft: 12,
  },
  qtyControls: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
  },
  qtyBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: '#ffffff',
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  qtyBtnDisabled: {
    opacity: 0.5,
  },
  qtyBtnText: { 
    fontSize: 18, 
    fontWeight: '600',
    color: '#1a1a2e',
  },
  qtyDisplay: {
    minWidth: 32,
    alignItems: 'center',
  },
  qtyText: { 
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  bottomContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cartSummary: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  cartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  submitButton: { 
    backgroundColor: '#1a1a2e',
    borderRadius: 16, 
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  submitButtonText: { 
    color: '#ffffff', 
    fontSize: 18, 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  updateButton: { 
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: '#1a1a2e',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
    color: '#1a1a2e',
    backgroundColor: '#f8fafc',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});


