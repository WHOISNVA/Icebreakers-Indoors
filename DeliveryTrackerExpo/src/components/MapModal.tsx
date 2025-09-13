import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Order } from '../types/order';

interface MapModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onComplete?: () => void;
}

const { width, height } = Dimensions.get('window');

export default function MapModal({ visible, order, onClose, onComplete }: MapModalProps) {
  if (!order) return null;

  // Calculate the region to show both markers
  const getMapRegion = () => {
    const locations = [order.origin];
    if (order.currentLocation) {
      locations.push(order.currentLocation);
    }

    const latitudes = locations.map(loc => loc.latitude);
    const longitudes = locations.map(loc => loc.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const latDelta = Math.max(0.01, (maxLat - minLat) * 1.5);
    const lngDelta = Math.max(0.01, (maxLng - minLng) * 1.5);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Order #{order.id.slice(-6)}</Text>
            <Text style={styles.subtitle}>Location Map</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={getMapRegion()}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {/* Order Origin Marker */}
          <Marker
            coordinate={{
              latitude: order.origin.latitude,
              longitude: order.origin.longitude,
            }}
            title="Order Origin"
            description={`Placed at ${new Date(order.createdAt).toLocaleTimeString()}`}
            pinColor="#ef4444"
          />

          {/* Current Location Marker */}
          {order.currentLocation && (
            <Marker
              coordinate={{
                latitude: order.currentLocation.latitude,
                longitude: order.currentLocation.longitude,
              }}
              title="Current Location"
              description={`Updated at ${new Date(order.currentLocation.timestamp).toLocaleTimeString()}`}
              pinColor="#10b981"
            />
          )}
        </MapView>

        <View style={styles.infoContainer}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Order Origin</Text>
            </View>
            {order.currentLocation && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.legendText}>Current Location</Text>
              </View>
            )}
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Order Details</Text>
            
            <View style={styles.itemsSection}>
              {order.items.map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemText}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>×{item.quantity}</Text>
                </View>
              ))}
            </View>
            
            {order.locationDescription && (
              <View style={styles.locationSection}>
                <Text style={styles.locationLabel}>📍 Customer Location</Text>
                <Text style={styles.locationText}>{order.locationDescription}</Text>
              </View>
            )}
            
            {order.currentLocationDescription && (
              <View style={styles.locationSection}>
                <Text style={styles.locationLabel}>📍 Updated Location</Text>
                <Text style={styles.locationText}>{order.currentLocationDescription}</Text>
              </View>
            )}
            
            <View style={styles.accuracySection}>
              {order.origin.accuracy && (
                <Text style={styles.accuracyText}>
                  Origin accuracy: ±{Math.round(order.origin.accuracy)}m
                </Text>
              )}
              {order.currentLocation?.accuracy && (
                <Text style={styles.accuracyText}>
                  Current accuracy: ±{Math.round(order.currentLocation.accuracy)}m
                </Text>
              )}
            </View>
          </View>
          
          {order.status !== 'completed' && onComplete && (
            <View style={styles.actionContainer}>
              <TouchableOpacity 
                style={styles.completeButton} 
                onPress={() => {
                  onComplete();
                  onClose();
                }}
              >
                <Text style={styles.completeButtonText}>Complete Order</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  infoContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  detailsCard: {
    padding: 24,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a2e',
  },
  itemsSection: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemText: {
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  locationSection: {
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 16,
    color: '#1a1a2e',
    lineHeight: 22,
  },
  accuracySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  accuracyText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    backgroundColor: '#ffffff',
  },
  completeButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  descriptionContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  descriptionText: {
    fontSize: 14,
    color: '#3C3C43',
  },
});
