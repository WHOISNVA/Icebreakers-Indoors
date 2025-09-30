import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { OrbitControls, Box, Plane } from '@react-three/drei/native';
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
    }
  }
}

import VenueManagementService, { Zone3D, Vector3D, VenueModel3D } from '../services/VenueManagementService';

interface VenueEditor3DProps {
  venue: VenueModel3D | null;
  onZoneCreated?: (zone: Zone3D) => void;
  onZoneSelected?: (zone: Zone3D | null) => void;
  editMode: 'view' | 'create' | 'edit';
  selectedZoneType: Zone3D['type'];
}

// Zone component for 3D rendering
function Zone3DComponent({ zone, isSelected, onClick }: { 
  zone: Zone3D; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      // Animate selected zones
      if (isSelected) {
        meshRef.current.rotation.z += 0.01;
      }
      
      // Hover effect
      if (hovered) {
        meshRef.current.scale.setScalar(1.05);
      } else {
        meshRef.current.scale.setScalar(1.0);
      }
    }
  });

  // Create geometry from zone vertices
  const geometry = React.useMemo(() => {
    const shape = new THREE.Shape();
    if (zone.vertices.length > 0) {
      shape.moveTo(zone.vertices[0].x, zone.vertices[0].y);
      for (let i = 1; i < zone.vertices.length; i++) {
        shape.lineTo(zone.vertices[i].x, zone.vertices[i].y);
      }
      shape.lineTo(zone.vertices[0].x, zone.vertices[0].y); // Close the shape
    }
    return new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
  }, [zone.vertices]);

  const material = React.useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: zone.color,
      transparent: true,
      opacity: zone.isActive ? 0.7 : 0.3,
      wireframe: !zone.isActive
    });
  }, [zone.color, zone.isActive]);

  return React.createElement('mesh', {
      ref: meshRef,
      geometry: geometry,
      material: material,
      position: [zone.center.x, zone.center.y, zone.center.z],
      onClick: onClick,
      onPointerOver: () => setHovered(true),
      onPointerOut: () => setHovered(false)
    },
      // Label removed in safe mode to avoid native text shader issues
    );
}

// Floor component
function Floor3D({ floor, zones, selectedZone, onZoneClick }: {
  floor: { level: number; height: number };
  zones: Zone3D[];
  selectedZone: Zone3D | null;
  onZoneClick: (zone: Zone3D) => void;
}) {
  return React.createElement('group', { position: [0, 0, floor.level * floor.height] },
      // Floor plane (keep minimal to avoid heavy shaders)
      React.createElement(Plane, {
        args: [100, 100],
        rotation: [-Math.PI / 2, 0, 0],
        position: [0, 0, 0],
        material: new THREE.MeshStandardMaterial({ color: "#eaeaea", transparent: true, opacity: 0.1 })
      }),

      // Zones on this floor
      ...zones
        .filter(zone => zone.floor === floor.level)
        .map(zone => 
          React.createElement(Zone3DComponent, {
            key: zone.id,
            zone: zone,
            isSelected: selectedZone?.id === zone.id,
            onClick: () => onZoneClick(zone)
          })
        )
  );
}

// Device markers (customers/bartenders)
function DeviceMarkers({ devices }: { devices: Map<string, any> }) {
  return React.createElement(React.Fragment, {},
    Array.from(devices.entries()).map(([deviceId, device]) =>
      React.createElement('group', { 
        key: deviceId, 
        position: [device.position.x, device.position.y, device.position.z] 
      },
        // Device marker
        React.createElement(Box, {
          args: [0.3, 0.3, 0.3],
          material: new THREE.MeshStandardMaterial({ 
            color: device.role === 'bartender' ? '#4CAF50' : '#2196F3' 
          })
        }),
        
        // Signal strength indicator
        device.rssi && React.createElement(Box, {
          args: [0.1, 0.1, Math.abs(device.rssi) / 10],
          position: [0.5, 0, 0],
          material: new THREE.MeshStandardMaterial({ 
            color: device.rssi > -50 ? '#4CAF50' : device.rssi > -70 ? '#FF9800' : '#F44336' 
          })
        })
      )
    )
  );
}

// Main 3D Scene
function Scene3D({ venue, selectedZone, onZoneClick, connectedDevices }: {
  venue: VenueModel3D;
  selectedZone: Zone3D | null;
  onZoneClick: (zone: Zone3D) => void;
  connectedDevices: Map<string, any>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    // Set initial camera position
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // Collect all zones from all floors
  const allZones = venue.floors.flatMap(floor => floor.zones);

  return React.createElement(React.Fragment, {},
      // Lighting
      React.createElement('ambientLight', { intensity: 0.6 }),
      React.createElement('directionalLight', { position: [10, 10, 5], intensity: 0.8 }),
      React.createElement('pointLight', { position: [0, 0, 10], intensity: 0.5 }),

      // Camera controls
      React.createElement(OrbitControls, { enablePan: true, enableZoom: true, enableRotate: true }),

      // Venue bounds
      React.createElement(Box, {
        args: [
          venue.bounds.max.x - venue.bounds.min.x,
          venue.bounds.max.y - venue.bounds.min.y,
          venue.bounds.max.z - venue.bounds.min.z
        ],
        position: [
          (venue.bounds.max.x + venue.bounds.min.x) / 2,
          (venue.bounds.max.y + venue.bounds.min.y) / 2,
          (venue.bounds.max.z + venue.bounds.min.z) / 2
        ],
        material: new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, wireframe: true })
      }),

      // Floors
      ...venue.floors.map(floor => 
        React.createElement(Floor3D, {
          key: floor.level,
          floor: floor,
          zones: allZones,
          selectedZone: selectedZone,
          onZoneClick: onZoneClick
        })
      ),

      // Device markers
      React.createElement(DeviceMarkers, { devices: connectedDevices })
  );
}

// Main component
export default function VenueEditor3D({
  venue,
  onZoneCreated,
  onZoneSelected,
  editMode,
  selectedZoneType
}: VenueEditor3DProps) {
  const [selectedZone, setSelectedZone] = useState<Zone3D | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<Map<string, any>>(new Map());
  const venueService = VenueManagementService.getInstance();

  useEffect(() => {
    // Update connected devices periodically
    const interval = setInterval(() => {
      setConnectedDevices(new Map(venueService.getConnectedDevices()));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleZoneClick = (zone: Zone3D) => {
    setSelectedZone(zone);
    onZoneSelected?.(zone);
  };

  const handleCanvasClick = (event: any) => {
    if (editMode === 'create') {
      // Create new zone at clicked position
      // This would be implemented with proper raycasting
      console.log('Create zone at:', event.point);
    }
  };

  if (!venue) {
    return (
      <View style={styles.container}>
        <RNText style={styles.noVenueText}>No venue loaded</RNText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Scene3D
          venue={venue}
          selectedZone={selectedZone}
          onZoneClick={handleZoneClick}
          connectedDevices={connectedDevices}
        />
      </Canvas>
      
      {/* Overlay UI for editing tools would go here */}
      {editMode === 'create' && (
        <View style={styles.createModeOverlay}>
          <RNText style={styles.overlayText}>
            Creating: {selectedZoneType} zone
          </RNText>
          <RNText style={styles.overlayHint}>
            Tap on the floor to place vertices
          </RNText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  canvas: {
    flex: 1,
  },
  noVenueText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  },
  createModeOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 8,
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  overlayHint: {
    color: '#cccccc',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
});
