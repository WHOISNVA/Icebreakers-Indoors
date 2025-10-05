import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { calculateDistance, calculateBearing, formatDistance, formatFloor, estimateFloor, calculateVerticalDistance } from '../utils/locationUtils';
import IndoorAtlasService from '../services/IndoorAtlasService';

interface ARNavigationViewProps {
  targetLatitude: number;
  targetLongitude: number;
  targetAltitude?: number;
  targetFloor?: number;
  targetName: string;
  onClose: () => void;
  onArrived?: () => void;
}

const { width, height } = Dimensions.get('window');

export default function ARNavigationView({
  targetLatitude,
  targetLongitude,
  targetAltitude,
  targetFloor,
  targetName,
  onClose,
  onArrived,
}: ARNavigationViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [hasArrived, setHasArrived] = useState(false);
  const [currentFloor, setCurrentFloor] = useState<number | null>(null);
  const [verticalDistance, setVerticalDistance] = useState<number | null>(null);
  
  const magnetometerSubscription = useRef<any>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Track device heading (compass)
  useEffect(() => {
    Magnetometer.setUpdateInterval(100);
    
    magnetometerSubscription.current = Magnetometer.addListener((data) => {
      // Calculate heading from magnetometer data
      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      angle = (angle + 360) % 360; // Normalize to 0-360
      setHeading(angle);
    });

    return () => {
      magnetometerSubscription.current?.remove();
    };
  }, []);

  // Track current location
  useEffect(() => {
    const startTracking = async () => {
      // Use IndoorAtlas for precise tracking (falls back to GPS automatically)
      const unsubscribe = await IndoorAtlasService.watchPosition((position) => {
        // Convert to Location.LocationObject format for compatibility
        const locationObject: Location.LocationObject = {
          coords: {
            latitude: position.latitude,
            longitude: position.longitude,
            altitude: position.altitude ?? 0,
            accuracy: position.accuracy,
            altitudeAccuracy: null,
            heading: position.heading ?? 0,
            speed: null,
          },
          timestamp: position.timestamp,
        };
        
        setCurrentLocation(locationObject);

        // Calculate distance to target
        const dist = calculateDistance(
          position.latitude,
          position.longitude,
          targetLatitude,
          targetLongitude
        );
        setDistance(dist);

        // Calculate bearing to target
        const bear = calculateBearing(
          position.latitude,
          position.longitude,
          targetLatitude,
          targetLongitude
        );
        setBearing(bear);

        // Floor detection - IndoorAtlas provides this directly!
        if (position.floor !== null) {
          setCurrentFloor(position.floor);
          console.log(`🏢 IndoorAtlas floor: ${position.floor}`);
        } else if (position.altitude) {
          const floor = estimateFloor(position.altitude);
          setCurrentFloor(floor);
        }

        // Calculate vertical distance
        if (targetAltitude && position.altitude) {
          const vertDist = calculateVerticalDistance(position.altitude, targetAltitude);
          setVerticalDistance(vertDist);
        }

        // Check if arrived (within 15 meters horizontally)
        if (dist <= 15 && !hasArrived) {
          setHasArrived(true);
          onArrived?.();
        }
        
        console.log(`📍 AR Position: ${position.source} - dist=${dist.toFixed(1)}m, accuracy=${position.accuracy.toFixed(1)}m`);
      });

      locationSubscription.current = { remove: unsubscribe } as any;
    };

    startTracking();

    return () => {
      locationSubscription.current?.remove();
    };
  }, [targetLatitude, targetLongitude, hasArrived, onArrived]);

  if (!permission) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required for AR navigation</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate relative direction (where to point arrow)
  const getDirectionAngle = (): number => {
    if (bearing === null) return 0;
    
    // Calculate the difference between target bearing and device heading
    let angle = bearing - heading;
    
    // Normalize to -180 to 180
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    
    return angle;
  };

  const directionAngle = getDirectionAngle();
  const isPointingCorrect = Math.abs(directionAngle) < 15; // Within 15 degrees

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView style={styles.camera} facing="back" />

      {/* AR Overlays */}
      <View style={styles.overlay}>
        {/* Top Info Bar */}
        <View style={styles.topBar}>
          <View style={styles.infoBox}>
            <Text style={styles.targetName}>{targetName}</Text>
            {distance !== null && (
              <Text style={styles.distance}>{formatDistance(distance)}</Text>
            )}
            {/* Floor Information */}
            {(currentFloor !== null || targetFloor !== null) && (
              <View style={styles.floorInfoContainer}>
                {currentFloor !== null && (
                  <Text style={styles.floorInfoText}>📍 You: {formatFloor(currentFloor)}</Text>
                )}
                {targetFloor !== null && (
                  <Text style={styles.floorInfoText}>🎯 Target: {formatFloor(targetFloor)}</Text>
                )}
                {verticalDistance !== null && verticalDistance > 1 && (
                  <Text style={[styles.floorInfoText, styles.floorWarning]}>
                    {currentFloor !== null && targetFloor !== null && currentFloor < targetFloor ? '⬆️' : '⬇️'} {verticalDistance.toFixed(1)}m vertical
                  </Text>
                )}
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Direction Arrow - Center of Screen */}
        <View style={styles.centerContainer}>
          {distance !== null && distance > 15 ? (
            <>
              {/* Large Arrow pointing to target */}
              <View
                style={[
                  styles.arrowContainer,
                  { transform: [{ rotate: `${directionAngle}deg` }] },
                ]}
              >
                <View style={[styles.arrow, isPointingCorrect && styles.arrowCorrect]}>
                  <Text style={styles.arrowText}>▲</Text>
                </View>
              </View>

              {/* Direction Text */}
              <View style={styles.directionBox}>
                <Text style={styles.directionText}>
                  {isPointingCorrect ? '🎯 Straight Ahead' : getDirectionText(directionAngle)}
                </Text>
                <Text style={styles.bearingText}>
                  Bearing: {bearing?.toFixed(0)}°
                </Text>
              </View>
            </>
          ) : (
            // Arrived!
            <View style={styles.arrivedContainer}>
              <Text style={styles.arrivedEmoji}>🎉</Text>
              <Text style={styles.arrivedText}>YOU'VE ARRIVED!</Text>
              <Text style={styles.arrivedSubtext}>You're at the destination</Text>
            </View>
          )}
        </View>

        {/* Bottom Info - Compass & Instructions */}
        <View style={styles.bottomBar}>
          <View style={styles.compassContainer}>
            <View style={[styles.compass, { transform: [{ rotate: `${-heading}deg` }] }]}>
              <Text style={styles.compassN}>N</Text>
            </View>
            <Text style={styles.compassLabel}>Heading: {heading.toFixed(0)}°</Text>
          </View>

          {distance !== null && distance > 15 && (
            <View style={styles.instructions}>
              <Text style={styles.instructionText}>
                📱 Point camera in the direction of the arrow
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// Helper function to get direction text
function getDirectionText(angle: number): string {
  if (angle > 15 && angle <= 75) return '↗️ Turn Right';
  if (angle > 75 && angle <= 105) return '➡️ Turn Right Sharp';
  if (angle > 105 && angle <= 165) return '↘️ Turn Around Right';
  if (angle > 165 || angle < -165) return '⬇️ Turn Around';
  if (angle >= -165 && angle < -105) return '↙️ Turn Around Left';
  if (angle >= -105 && angle < -75) return '⬅️ Turn Left Sharp';
  if (angle >= -75 && angle < -15) return '↖️ Turn Left';
  return '⬆️ Straight Ahead';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  infoBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  targetName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  distance: {
    color: '#34C759',
    fontSize: 28,
    fontWeight: '800',
  },
  floorInfoContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  floorInfoText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 2,
  },
  floorWarning: {
    color: '#FF9500',
    fontWeight: '700',
    fontSize: 15,
  },
  closeBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },
  // Center Arrow
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  arrowCorrect: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    borderColor: '#FFF',
    borderWidth: 6,
  },
  arrowText: {
    color: '#FFF',
    fontSize: 60,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  directionBox: {
    marginTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  directionText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  bearingText: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '600',
  },
  // Arrived State
  arrivedContainer: {
    backgroundColor: 'rgba(52, 199, 89, 0.95)',
    paddingVertical: 40,
    paddingHorizontal: 50,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  arrivedEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  arrivedText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
  },
  arrivedSubtext: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // Bottom Bar
  bottomBar: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  compassContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  compass: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  compassN: {
    color: '#FF3B30',
    fontSize: 24,
    fontWeight: '900',
  },
  compassLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  instructions: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  instructionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Permission Screen
  permissionText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  permissionBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

