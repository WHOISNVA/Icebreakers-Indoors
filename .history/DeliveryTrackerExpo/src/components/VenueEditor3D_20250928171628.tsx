import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { Text, OrbitControls, Grid, Box, Plane } from '@react-three/drei/native';
import * as THREE from 'three';

declare module '@react-three/fiber' {
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

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[zone.center.x, zone.center.y, zone.center.z]}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Zone label */}
      <Text
        position={[0, 0, 1]}
        fontSize={0.5}
        color={isSelected ? '#ffffff' : '#000000'}
        anchorX="center"
        anchorY="middle"
      >
        {zone.name}
      </Text>
    </mesh>
  );
}

// Floor component
function Floor3D({ floor, zones, selectedZone, onZoneClick }: {
  floor: { level: number; height: number };
  zones: Zone3D[];
  selectedZone: Zone3D | null;
  onZoneClick: (zone: Zone3D) => void;
}) {
  return (
    <group position={[0, 0, floor.level * floor.height]}>
      {/* Floor plane */}
      <Plane
        args={[100, 100]}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        material={new THREE.MeshStandardMaterial({ color: "#f0f0f0", transparent: true, opacity: 0.1 })}
      />
      
      {/* Floor grid */}
      <Grid
        args={[100, 100]}
        position={[0, 0, 0.01]}
        rotation={[-Math.PI / 2, 0, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#cccccc"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#999999"
      />

      {/* Floor label */}
      <Text
        position={[-45, 0, 2]}
        fontSize={2}
        color="#666666"
        anchorX="left"
        anchorY="middle"
      >
        Floor {floor.level}
      </Text>

      {/* Zones on this floor */}
      {zones
        .filter(zone => zone.floor === floor.level)
        .map(zone => (
          <Zone3DComponent
            key={zone.id}
            zone={zone}
            isSelected={selectedZone?.id === zone.id}
            onClick={() => onZoneClick(zone)}
          />
        ))}
    </group>
  );
}

// Device markers (customers/bartenders)
function DeviceMarkers({ devices }: { devices: Map<string, any> }) {
  return (
    <>
      {Array.from(devices.entries()).map(([deviceId, device]) => (
        <group key={deviceId} position={[device.position.x, device.position.y, device.position.z]}>
          {/* Device marker */}
          <Box 
            args={[0.3, 0.3, 0.3]}
            material={new THREE.MeshStandardMaterial({ 
              color: device.role === 'bartender' ? '#4CAF50' : '#2196F3' 
            })}
          />
          
          {/* Device label */}
          <Text
            position={[0, 0, 0.5]}
            fontSize={0.3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {device.role === 'bartender' ? '🍺' : '👤'}
          </Text>
          
          {/* Signal strength indicator */}
          {device.rssi && (
            <Box 
              args={[0.1, 0.1, Math.abs(device.rssi) / 10]}
              position={[0.5, 0, 0]}
              material={new THREE.MeshStandardMaterial({ 
                color: device.rssi > -50 ? '#4CAF50' : device.rssi > -70 ? '#FF9800' : '#F44336' 
              })}
            />
          )}
        </group>
      ))}
    </>
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

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 0, 10]} intensity={0.5} />

      {/* Camera controls */}
      <OrbitControls enablePan enableZoom enableRotate />

      {/* Venue bounds */}
      <Box
        args={[
          venue.bounds.max.x - venue.bounds.min.x,
          venue.bounds.max.y - venue.bounds.min.y,
          venue.bounds.max.z - venue.bounds.min.z
        ]}
        position={[
          (venue.bounds.max.x + venue.bounds.min.x) / 2,
          (venue.bounds.max.y + venue.bounds.min.y) / 2,
          (venue.bounds.max.z + venue.bounds.min.z) / 2
        ]}
        material={new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, wireframe: true })}
      />

      {/* Floors */}
      {venue.floors.map(floor => (
        <Floor3D
          key={floor.level}
          floor={floor}
          zones={allZones}
          selectedZone={selectedZone}
          onZoneClick={onZoneClick}
        />
      ))}

      {/* Device markers */}
      <DeviceMarkers devices={connectedDevices} />

      {/* Venue title */}
      <Text
        position={[0, 0, venue.bounds.max.z + 5]}
        fontSize={3}
        color="#333333"
        anchorX="center"
        anchorY="middle"
      >
        {venue.name}
      </Text>
    </>
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
