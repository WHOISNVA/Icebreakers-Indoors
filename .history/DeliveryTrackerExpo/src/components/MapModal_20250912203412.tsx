import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Order } from '../types/order';

interface MapModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export default function MapModal({ visible, order, onClose }: MapModalProps) {
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
          <Text style={styles.title}>Order {order.id}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
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
            pinColor="red"
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
              pinColor="blue"
            />
          )}
        </MapView>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'red' }]} />
            <Text style={styles.legendText}>Order Origin</Text>
          </View>
          {order.currentLocation && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'blue' }]} />
              <Text style={styles.legendText}>Current Location</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>Order Details</Text>
          {order.items.map(item => (
            <Text key={item.id} style={styles.infoText}>
              {item.name} x{item.quantity}
            </Text>
          ))}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
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
    color: '#3C3C43',
  },
  info: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1C1C1E',
  },
  infoText: {
    fontSize: 14,
    color: '#3C3C43',
    marginBottom: 4,
  },
  accuracyText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
  },
});
