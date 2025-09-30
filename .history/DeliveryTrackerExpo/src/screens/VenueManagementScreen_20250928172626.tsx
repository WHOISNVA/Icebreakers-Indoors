import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Switch,
  Dimensions
} from 'react-native';
import VenueManagementService, { 
  VenueModel3D, 
  Zone3D, 
  Vector3D, 
  ProximityAlert,
  ARPositioning 
} from '../services/VenueManagementService';
import VenueEditor3D from '../components/VenueEditor3D';

const { width, height } = Dimensions.get('window');

type EditMode = 'view' | 'create' | 'edit';
type ZoneType = Zone3D['type'];

export default function VenueManagementScreen() {
  const [venue, setVenue] = useState<VenueModel3D | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [selectedZoneType, setSelectedZoneType] = useState<ZoneType>('bar');
  const [selectedZone, setSelectedZone] = useState<Zone3D | null>(null);
  const [showCreateVenueModal, setShowCreateVenueModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [arEnabled, setArEnabled] = useState(false);
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [arPosition, setArPosition] = useState<ARPositioning | null>(null);
  
  // Form states
  const [venueName, setVenueName] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneCapacity, setZoneCapacity] = useState('');
  const [zoneColor, setZoneColor] = useState('#4CAF50');

  const venueService = VenueManagementService.getInstance({
    onProximityAlert: (alert) => {
      setProximityAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
    },
    onARTrackingChanged: (position) => {
      setArPosition(position);
    },
    proximityThreshold: 2.0,
    enableHaptics: true,
    enableAudio: true
  });

  useEffect(() => {
    // Load existing venue or create default
    loadOrCreateVenue();
    
    // Start beacon scanning
    venueService.startBeaconScanning();

    return () => {
      venueService.cleanup();
    };
  }, []);

  const loadOrCreateVenue = async () => {
    // Try to load existing venue
    const existingVenue = await venueService.loadVenue('default');
    if (existingVenue) {
      setVenue(existingVenue);
    } else {
      // Show create venue modal
      setShowCreateVenueModal(true);
    }
  };

  const handleCreateVenue = async () => {
    if (!venueName.trim()) {
      Alert.alert('Error', 'Please enter a venue name');
      return;
    }

    try {
      // Get current GPS location for reference
      const newVenue = await venueService.createVenue(venueName, {
        lat: 25.7612,
        lng: -80.1923,
        alt: 10
      });
      
      setVenue(newVenue);
      setShowCreateVenueModal(false);
      setVenueName('');
      
      Alert.alert('Success', `Venue "${newVenue.name}" created successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create venue');
      console.error(error);
    }
  };

  const handleCreateZone = async () => {
    if (!zoneName.trim()) {
      Alert.alert('Error', 'Please enter a zone name');
      return;
    }

    try {
      // Create a default rectangular zone
      const defaultVertices: Vector3D[] = [
        { x: -2, y: -2, z: 0 },
        { x: 2, y: -2, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: -2, y: 2, z: 0 }
      ];

      const newZone = await venueService.addZone({
        name: zoneName,
        type: selectedZoneType,
        vertices: defaultVertices,
        floor: 1,
        capacity: parseInt(zoneCapacity) || undefined,
        color: zoneColor,
        isActive: true,
        specialties: getDefaultSpecialties(selectedZoneType)
      });

      // Refresh venue
      const updatedVenue = venueService.getCurrentVenue();
      setVenue(updatedVenue);
      
      setShowZoneModal(false);
      resetZoneForm();
      
      Alert.alert('Success', `Zone "${newZone.name}" created successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create zone');
      console.error(error);
    }
  };

  const getDefaultSpecialties = (type: ZoneType): string[] => {
    switch (type) {
      case 'bar': return ['cocktails', 'beer', 'wine'];
      case 'kitchen': return ['food', 'appetizers'];
      case 'pool': return ['frozen_drinks', 'beer'];
      default: return [];
    }
  };

  const resetZoneForm = () => {
    setZoneName('');
    setZoneCapacity('');
    setZoneColor('#4CAF50');
  };

  const toggleAR = async () => {
    if (!arEnabled) {
      const success = await venueService.startARSession();
      if (success) {
        setArEnabled(true);
        Alert.alert('AR Started', 'Indoor positioning is now active');
      } else {
        Alert.alert('AR Failed', 'Could not start AR session');
      }
    } else {
      await venueService.stopARSession();
      setArEnabled(false);
      setArPosition(null);
    }
  };

  const zoneTypes: ZoneType[] = ['bar', 'seating', 'entrance', 'restroom', 'kitchen', 'stage', 'pool', 'deck'];
  const zoneColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#795548', '#607D8B', '#E91E63'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Venue Management</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.headerBtn, arEnabled && styles.headerBtnActive]}
            onPress={toggleAR}
          >
            <Text style={[styles.headerBtnText, arEnabled && styles.headerBtnTextActive]}>
              {arEnabled ? '📍 AR ON' : '📍 AR OFF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerBtn}
            onPress={() => setShowSettingsModal(true)}
          >
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3D Venue Editor */}
      {venue && (
        <View style={styles.editorContainer}>
          <VenueEditor3D
            venue={venue}
            editMode={editMode}
            selectedZoneType={selectedZoneType}
            onZoneCreated={(zone) => {
              const updatedVenue = venueService.getCurrentVenue();
              setVenue(updatedVenue);
            }}
            onZoneSelected={setSelectedZone}
          />
        </View>
      )}

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.controlBtn, editMode === 'view' && styles.controlBtnActive]}
            onPress={() => setEditMode('view')}
          >
            <Text style={styles.controlBtnText}>👁️ View</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlBtn, editMode === 'create' && styles.controlBtnActive]}
            onPress={() => setEditMode('create')}
          >
            <Text style={styles.controlBtnText}>➕ Create</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlBtn, editMode === 'edit' && styles.controlBtnActive]}
            onPress={() => setEditMode('edit')}
          >
            <Text style={styles.controlBtnText}>✏️ Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setShowZoneModal(true)}
          >
            <Text style={styles.controlBtnText}>🏗️ Add Zone</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Status Panel */}
      <View style={styles.statusPanel}>
        <ScrollView>
          {/* AR Status */}
          {arPosition && (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>AR Position</Text>
              <Text style={styles.statusText}>
                X: {arPosition.position.x.toFixed(2)}m, Y: {arPosition.position.y.toFixed(2)}m
              </Text>
              <Text style={styles.statusText}>
                Confidence: {(arPosition.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          )}

          {/* Connected Devices */}
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Connected Devices</Text>
            <Text style={styles.statusText}>
              {venueService.getConnectedDevices().size} devices nearby
            </Text>
          </View>

          {/* Recent Proximity Alerts */}
          {proximityAlerts.length > 0 && (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>Recent Alerts</Text>
              {proximityAlerts.slice(0, 3).map((alert, index) => (
                <Text key={index} style={styles.alertText}>
                  🔔 Bartender arrived ({alert.distance.toFixed(1)}m)
                </Text>
              ))}
            </View>
          )}

          {/* Selected Zone Info */}
          {selectedZone && (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>Selected Zone</Text>
              <Text style={styles.statusText}>{selectedZone.name}</Text>
              <Text style={styles.statusText}>Type: {selectedZone.type}</Text>
              <Text style={styles.statusText}>Floor: {selectedZone.floor}</Text>
              {selectedZone.capacity && (
                <Text style={styles.statusText}>Capacity: {selectedZone.capacity}</Text>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Create Venue Modal */}
      <Modal visible={showCreateVenueModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Venue</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Venue Name"
              value={venueName}
              onChangeText={setVenueName}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtn} onPress={handleCreateVenue}>
                <Text style={styles.modalBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Zone Modal */}
      <Modal visible={showZoneModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Zone</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Zone Name"
              value={zoneName}
              onChangeText={setZoneName}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Capacity (optional)"
              value={zoneCapacity}
              onChangeText={setZoneCapacity}
              keyboardType="numeric"
            />

            {/* Zone Type Selector */}
            <Text style={styles.sectionTitle}>Zone Type</Text>
            <ScrollView horizontal style={styles.typeSelector}>
              {zoneTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeBtn,
                    selectedZoneType === type && styles.typeBtnActive
                  ]}
                  onPress={() => setSelectedZoneType(type)}
                >
                  <Text style={[
                    styles.typeBtnText,
                    selectedZoneType === type && styles.typeBtnTextActive
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Color Selector */}
            <Text style={styles.sectionTitle}>Zone Color</Text>
            <ScrollView horizontal style={styles.colorSelector}>
              {zoneColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorBtn,
                    { backgroundColor: color },
                    zoneColor === color && styles.colorBtnActive
                  ]}
                  onPress={() => setZoneColor(color)}
                />
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnSecondary]} 
                onPress={() => {
                  setShowZoneModal(false);
                  resetZoneForm();
                }}
              >
                <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={handleCreateZone}>
                <Text style={styles.modalBtnText}>Create Zone</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Venue Settings</Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>AR Indoor Positioning</Text>
              <Switch value={arEnabled} onValueChange={toggleAR} />
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <Switch value={true} onValueChange={() => {}} />
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Audio Alerts</Text>
              <Switch value={true} onValueChange={() => {}} />
            </View>
            
            <TouchableOpacity 
              style={[styles.modalBtn, styles.modalBtnSecondary]} 
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.modalBtnTextSecondary}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  headerBtnActive: {
    backgroundColor: '#4CAF50',
  },
  headerBtnText: {
    fontSize: 14,
    color: '#666',
  },
  headerBtnTextActive: {
    color: '#ffffff',
  },
  editorContainer: {
    flex: 1,
    minHeight: height * 0.5,
  },
  controlPanel: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  controlBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  controlBtnActive: {
    backgroundColor: '#2196F3',
  },
  controlBtnText: {
    fontSize: 14,
    color: '#666',
  },
  statusPanel: {
    height: 120,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 12,
  },
  statusCard: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  alertText: {
    fontSize: 12,
    color: '#FF9800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  typeSelector: {
    marginBottom: 16,
  },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  typeBtnActive: {
    backgroundColor: '#2196F3',
  },
  typeBtnText: {
    fontSize: 14,
    color: '#666',
  },
  typeBtnTextActive: {
    color: '#ffffff',
  },
  colorSelector: {
    marginBottom: 16,
  },
  colorBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorBtnActive: {
    borderColor: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  modalBtnSecondary: {
    backgroundColor: '#f0f0f0',
  },
  modalBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalBtnTextSecondary: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
});
