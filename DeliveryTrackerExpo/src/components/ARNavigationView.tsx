import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { calculateDistance, calculateBearing, formatDistance, formatFloor, estimateFloor, calculateVerticalDistance } from '../utils/locationUtils';
import IndoorAtlasService from '../services/IndoorAtlasService';
import IndoorAtlasARService, { IARoute, IAWaypoint } from '../services/IndoorAtlasARService';

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
  const [useIndoorAtlasHeading, setUseIndoorAtlasHeading] = useState(false);
  const [wayfindingRoute, setWayfindingRoute] = useState<IARoute | null>(null);
  
  const magnetometerSubscription = useRef<any>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const wayfindingUnsubscribe = useRef<(() => void) | null>(null);

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
      // This also initializes IndoorAtlas if not already initialized
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

        // Use IndoorAtlas heading if available (much more accurate than magnetometer indoors!)
        if (position.heading !== null && position.heading !== undefined && position.heading !== 0) {
          setHeading(position.heading);
          setUseIndoorAtlasHeading(true);
          console.log(`🧭 Using IndoorAtlas heading: ${position.heading.toFixed(0)}°`);
        }

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

        // Check if arrived (within 3 meters - exact location)
        // This ensures we only show "ARRIVED" when at the precise pin location
        if (dist <= 3 && !hasArrived) {
          setHasArrived(true);
          onArrived?.();
        }
        
        console.log(`📍 AR Position: ${position.source} - dist=${dist.toFixed(1)}m, accuracy=${position.accuracy.toFixed(1)}m, heading=${position.heading?.toFixed(0)}°`);
      });

      locationSubscription.current = { remove: unsubscribe } as any;
      
      // Start wayfinding AFTER IndoorAtlas is initialized
      // Wait 1 second for initialization to complete
      if (IndoorAtlasARService.isARWayfindingAvailable()) {
        setTimeout(async () => {
          try {
            const wayfindingStarted = await IndoorAtlasARService.startARWayfinding(
              targetLatitude,
              targetLongitude,
              targetFloor ?? undefined
            );
            
            if (wayfindingStarted) {
              console.log('🎯 IndoorAtlas wayfinding started successfully');
              
              // Subscribe to wayfinding route updates
              wayfindingUnsubscribe.current = IndoorAtlasARService.onWayfindingUpdate((route) => {
                console.log(`🗺️ Wayfinding route received: ${route.waypoints.length} waypoints, ${route.length}m`);
                setWayfindingRoute(route);
              });
            }
          } catch (error) {
            console.log('⚠️ Wayfinding not available:', error);
            // Continue without wayfinding - will use direct arrow guidance
          }
        }, 1000);
      }
    };

    startTracking();

    return () => {
      // Stop wayfinding
      if (IndoorAtlasARService.isARWayfindingAvailable()) {
        IndoorAtlasARService.stopARWayfinding().catch(err => 
          console.log('⚠️ Error stopping wayfinding:', err)
        );
        wayfindingUnsubscribe.current?.();
      }
      
      locationSubscription.current?.remove();
    };
  }, [targetLatitude, targetLongitude, targetFloor, hasArrived, onArrived]);

  if (!permission) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required for AR navigation</Text>
        <TouchableOpacity 
          style={styles.permissionBtn} 
          onPress={async () => {
            console.log('📸 Requesting camera permission...');
            const result = await requestPermission();
            console.log('📸 Camera permission result:', result);
          }}
        >
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

  // Calculate vertical tilt for floor navigation
  const getVerticalTiltAngle = (): number => {
    if (currentFloor === null || targetFloor === null || targetFloor === undefined) {
      return 0; // No tilt if floor info unavailable
    }
    
    const floorDifference = targetFloor - currentFloor;
    
    if (floorDifference === 0) {
      return 0; // Same floor, no tilt
    }
    
    // Calculate tilt angle based on floor difference and horizontal distance
    // More floors = steeper angle, closer distance = steeper angle
    const horizontalDistance = distance || 50; // Default to 50m if unknown
    
    // Average floor height is ~4 meters
    const verticalDistance = Math.abs(floorDifference) * 4;
    
    // Calculate angle using arctangent (opposite/adjacent)
    const tiltRadians = Math.atan(verticalDistance / horizontalDistance);
    let tiltDegrees = (tiltRadians * 180) / Math.PI;
    
    // Cap the tilt angle at 45 degrees for visibility
    tiltDegrees = Math.min(tiltDegrees, 45);
    
    // Return negative for down, positive for up
    return floorDifference > 0 ? tiltDegrees : -tiltDegrees;
  };

  const directionAngle = getDirectionAngle();
  const verticalTilt = getVerticalTiltAngle();
  const isPointingCorrect = Math.abs(directionAngle) < 15; // Within 15 degrees
  const needsFloorChange = currentFloor !== null && targetFloor !== null && 
                          targetFloor !== undefined && currentFloor !== targetFloor;

  // Render 3D waypoint markers along the route
  const renderWaypoints = () => {
    if (!wayfindingRoute || !currentLocation || distance === null || distance > 50) {
      return null; // Don't show waypoints if too far or no route
    }

    return wayfindingRoute.waypoints.map((waypoint, index) => {
      // Skip waypoints on different floors
      if (currentFloor !== null && waypoint.floor !== undefined && waypoint.floor !== currentFloor) {
        return null;
      }

      // Calculate distance to this waypoint
      const waypointDist = calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        waypoint.latitude,
        waypoint.longitude
      );

      // Only show waypoints within 30 meters
      if (waypointDist > 30) {
        return null;
      }

      // Calculate bearing to waypoint
      const waypointBearing = calculateBearing(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        waypoint.latitude,
        waypoint.longitude
      );

      // Calculate relative angle for this waypoint
      let waypointAngle = waypointBearing - heading;
      while (waypointAngle > 180) waypointAngle -= 360;
      while (waypointAngle < -180) waypointAngle += 360;

      // Only show waypoints roughly in front (within 120 degrees)
      if (Math.abs(waypointAngle) > 120) {
        return null;
      }

      // Calculate screen position based on angle
      // Center is 0, left is negative, right is positive
      const horizontalOffset = (waypointAngle / 120) * (width * 0.4);

      // Calculate vertical position based on distance (closer = lower on screen)
      const verticalOffset = Math.max(-100, -waypointDist * 3);

      // Scale based on distance (closer = larger)
      const scale = Math.max(0.5, Math.min(1.5, 15 / waypointDist));

      return (
        <View
          key={`waypoint-${index}`}
          style={[
            styles.waypoint3D,
            {
              transform: [
                { translateX: horizontalOffset },
                { translateY: verticalOffset },
                { scale },
              ],
            },
          ]}
        >
          {/* 3D waypoint sphere */}
          <View style={styles.waypointSphere}>
            <View style={[styles.waypointLayer, styles.waypointShadowLayer]} />
            <View style={[styles.waypointLayer, styles.waypointMainLayer]} />
            <View style={styles.waypointGlow} />
          </View>
          {/* Distance label */}
          <Text style={styles.waypointDistanceText}>
            {waypointDist.toFixed(0)}m
          </Text>
        </View>
      );
    }).filter(Boolean); // Remove null entries
  };

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
                {targetFloor !== null && targetFloor !== undefined && (
                  <Text style={styles.floorInfoText}>🎯 Target: {formatFloor(targetFloor)}</Text>
                )}
                {verticalDistance !== null && verticalDistance > 1 && (
                  <Text style={[styles.floorInfoText, styles.floorWarning]}>
                    {currentFloor !== null && targetFloor !== null && targetFloor !== undefined && currentFloor < targetFloor ? '⬆️' : '⬇️'} {verticalDistance.toFixed(1)}m vertical
                  </Text>
                )}
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 3D Pin Marker - Only visible when within 3 meters */}
        {distance !== null && distance <= 3 && (
          <View style={styles.pinMarkerContainer}>
            <View
              style={[
                styles.pinMarker3DContainer,
                { 
                  transform: [
                    { rotate: `${directionAngle}deg` },
                    { perspective: 1500 },
                    { rotateX: `${-verticalTilt}deg` },
                    // Scale based on distance for depth perception (larger when closer)
                    { scale: distance !== null ? Math.min(2.0, Math.max(1.0, 6 / distance)) : 1 },
                  ] 
                },
              ]}
            >
              {/* 3D Pin with shadow layers */}
              <View style={styles.pin3D}>
                {/* Pin shadow/depth layers for 3D effect */}
                <View style={[styles.pinLayer, styles.pinShadowLayer3]} />
                <View style={[styles.pinLayer, styles.pinShadowLayer2]} />
                <View style={[styles.pinLayer, styles.pinShadowLayer1]} />
                {/* Main pin */}
                <View style={[styles.pinLayer, styles.pinMainLayer]}>
                  {/* Pin Head (Circle) */}
                  <View style={[
                    styles.pinHeadMarker,
                    hasArrived && styles.pinHeadMarkerArrived
                  ]} />
                  {/* Pin Shaft (Vertical line) */}
                  <View style={[
                    styles.pinShaftMarker,
                    hasArrived && styles.pinShaftMarkerArrived
                  ]} />
                  {/* Pin Point (Small triangle at bottom) */}
                  <View style={[
                    styles.pinPointMarker,
                    hasArrived && styles.pinPointMarkerArrived
                  ]} />
                </View>
              </View>
              {/* Pulsing circle at base of pin */}
              <View style={[
                styles.pinBasePulse,
                hasArrived && styles.pinBasePulseArrived
              ]} />
              
              {/* Celebration animation when arrived */}
              {hasArrived && (
                <View style={styles.celebrationContainer}>
                  {/* Confetti/sparkles effect */}
                  <Text style={[styles.celebrationEmoji, styles.celebrationEmoji1]}>🎉</Text>
                  <Text style={[styles.celebrationEmoji, styles.celebrationEmoji2]}>✨</Text>
                  <Text style={[styles.celebrationEmoji, styles.celebrationEmoji3]}>🎊</Text>
                  <Text style={[styles.celebrationEmoji, styles.celebrationEmoji4]}>⭐</Text>
                  <Text style={[styles.celebrationEmoji, styles.celebrationEmoji5]}>💫</Text>
                  <Text style={[styles.celebrationEmoji, styles.celebrationEmoji6]}>🌟</Text>
                  {/* Radiating circles */}
                  <View style={[styles.celebrationRing, styles.celebrationRing1]} />
                  <View style={[styles.celebrationRing, styles.celebrationRing2]} />
                  <View style={[styles.celebrationRing, styles.celebrationRing3]} />
                </View>
              )}
            </View>
          </View>
        )}

        {/* 3D Waypoint Markers along route */}
        {wayfindingRoute && distance !== null && distance > 3 && (
          <View style={styles.waypointsContainer}>
            {renderWaypoints()}
          </View>
        )}

        {/* Direction Arrow - Center of Screen */}
        <View style={styles.centerContainer}>
          {distance !== null && distance > 3 ? (
            <>
              {/* 3D Arrow pointing to target with floor navigation */}
              <View
                style={[
                  styles.arrowContainer,
                  { 
                    transform: [
                      { rotate: `${directionAngle}deg` },
                      { perspective: 1000 },
                      { rotateX: `${-verticalTilt}deg` }, // Negative because rotateX is inverted
                    ] 
                  },
                ]}
              >
                {/* 3D Arrow with depth effect */}
                <View style={[
                  styles.arrow3D, 
                  isPointingCorrect && !needsFloorChange && styles.arrowCorrect3D
                ]}>
                  {/* Arrow shadow/depth layers */}
                  <View style={[styles.arrowLayer, styles.arrowShadow3]} />
                  <View style={[styles.arrowLayer, styles.arrowShadow2]} />
                  <View style={[styles.arrowLayer, styles.arrowShadow1]} />
                  {/* Main arrow */}
                  <View style={[styles.arrowLayer, styles.arrowMain]}>
                    {/* Arrow Point (Triangle) */}
                    <View style={styles.arrowPointContainer}>
                      <View style={[
                        styles.arrowPoint,
                        isPointingCorrect && !needsFloorChange && styles.arrowPointCorrect,
                        needsFloorChange && styles.arrowPointFloorChange
                      ]} />
                    </View>
                    {/* Arrow Head (Wide block) */}
                    <View style={[
                      styles.arrowHead,
                      isPointingCorrect && !needsFloorChange && styles.arrowHeadCorrect,
                      needsFloorChange && styles.arrowHeadFloorChange
                    ]} />
                    {/* Arrow Shaft (Narrow block) */}
                    <View style={[
                      styles.arrowShaft,
                      isPointingCorrect && !needsFloorChange && styles.arrowShaftCorrect,
                      needsFloorChange && styles.arrowShaftFloorChange
                    ]} />
                  </View>
                </View>
              </View>

              {/* Direction Text */}
              <View style={styles.directionBox}>
                <Text style={styles.directionText}>
                  {needsFloorChange 
                    ? `${verticalTilt > 0 ? '⬆️ GO UP' : '⬇️ GO DOWN'} ${Math.abs(targetFloor! - currentFloor!)} Floor${Math.abs(targetFloor! - currentFloor!) > 1 ? 's' : ''}`
                    : isPointingCorrect ? '🎯 Straight Ahead' : getDirectionText(directionAngle)
                  }
                </Text>
                <Text style={styles.bearingText}>
                  Bearing: {bearing?.toFixed(0)}°
                  {needsFloorChange && verticalDistance !== null && ` • ${verticalDistance.toFixed(0)}m vertical`}
                </Text>
              </View>
            </>
          ) : (
            // Arrived - Show larger celebration pin!
            <View style={styles.arrivedContainer}>
              <Text style={styles.arrivedEmoji}>🎉</Text>
              <Text style={styles.arrivedText}>YOU'VE ARRIVED!</Text>
              <Text style={styles.arrivedSubtext}>Customer is at this location</Text>
              <Text style={styles.arrivedSubtext}>📍 Look for the glowing pin above</Text>
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

          {distance !== null && distance > 3 && (
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
  // 3D Arrow Styles
  arrow3D: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowCorrect3D: {
    // Add green glow when pointing correct
  },
  arrowLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowShadow3: {
    width: 140,
    height: 140,
    opacity: 0.15,
    transform: [{ translateY: 12 }, { scale: 0.98 }],
  },
  arrowShadow2: {
    width: 140,
    height: 140,
    opacity: 0.25,
    transform: [{ translateY: 8 }, { scale: 0.99 }],
  },
  arrowShadow1: {
    width: 140,
    height: 140,
    opacity: 0.35,
    transform: [{ translateY: 4 }],
  },
  arrowMain: {
    width: 140,
    height: 140,
    transform: [{ translateY: 0 }],
  },
  arrowPointContainer: {
    alignItems: 'center',
  },
  arrowPoint: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 40,
    borderRightWidth: 40,
    borderBottomWidth: 35,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#007AFF',
  },
  arrowPointCorrect: {
    borderBottomColor: '#34C759',
  },
  arrowPointFloorChange: {
    borderBottomColor: '#FF9500',
  },
  arrowHead: {
    width: 80,
    height: 30,
    backgroundColor: '#007AFF',
    marginTop: -1, // Slight overlap with point
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  arrowShaft: {
    width: 50,
    height: 50,
    backgroundColor: '#007AFF',
    marginTop: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  arrowHeadCorrect: {
    backgroundColor: '#34C759', // Green when pointing correct
  },
  arrowShaftCorrect: {
    backgroundColor: '#34C759', // Green when pointing correct
  },
  arrowHeadFloorChange: {
    backgroundColor: '#FF9500', // Orange when floor change needed
  },
  arrowShaftFloorChange: {
    backgroundColor: '#FF9500', // Orange when floor change needed
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
  // 3D Pin Marker Styles (Always visible in AR)
  pinMarkerContainer: {
    position: 'absolute',
    top: '30%', // Position in upper portion of screen
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none', // Don't block touch events
  },
  pinMarker3DContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin3D: {
    width: 80,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pinLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 80,
    height: 100,
  },
  pinShadowLayer3: {
    opacity: 0.15,
    transform: [{ translateY: 12 }, { scale: 0.97 }],
  },
  pinShadowLayer2: {
    opacity: 0.25,
    transform: [{ translateY: 8 }, { scale: 0.98 }],
  },
  pinShadowLayer1: {
    opacity: 0.35,
    transform: [{ translateY: 4 }, { scale: 0.99 }],
  },
  pinMainLayer: {
    transform: [{ translateY: 0 }],
  },
  pinHeadMarker: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
    borderWidth: 5,
    borderColor: '#FFF',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  pinHeadMarkerArrived: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    borderWidth: 6,
  },
  pinShaftMarker: {
    width: 10,
    height: 40,
    backgroundColor: '#FF3B30',
    marginTop: -10,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  pinShaftMarkerArrived: {
    backgroundColor: '#34C759',
  },
  pinPointMarker: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 15,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF3B30',
    marginTop: -2,
  },
  pinPointMarkerArrived: {
    borderTopColor: '#34C759',
  },
  pinBasePulse: {
    position: 'absolute',
    bottom: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    // This would animate in production
  },
  pinBasePulseArrived: {
    backgroundColor: 'rgba(52, 199, 89, 0.4)',
    borderColor: 'rgba(52, 199, 89, 0.6)',
  },
  // Celebration Animation Styles
  celebrationContainer: {
    position: 'absolute',
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    top: -100,
  },
  celebrationEmoji: {
    position: 'absolute',
    fontSize: 32,
    // In production, these would be animated using React Native Animated API
  },
  celebrationEmoji1: {
    top: -40,
    left: -20,
    // Would animate: translateY from -40 to -80, opacity from 1 to 0
  },
  celebrationEmoji2: {
    top: -30,
    right: -10,
    // Would animate: translateY from -30 to -70, opacity from 1 to 0
  },
  celebrationEmoji3: {
    top: -50,
    left: 30,
    // Would animate: translateY from -50 to -90, opacity from 1 to 0
  },
  celebrationEmoji4: {
    top: -35,
    right: 35,
    // Would animate: translateY from -35 to -75, opacity from 1 to 0
  },
  celebrationEmoji5: {
    top: -45,
    left: -30,
    // Would animate: translateY from -45 to -85, opacity from 1 to 0
  },
  celebrationEmoji6: {
    top: -25,
    right: -25,
    // Would animate: translateY from -25 to -65, opacity from 1 to 0
  },
  celebrationRing: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 3,
    borderColor: 'rgba(52, 199, 89, 0.5)',
    // In production, would animate scale and opacity
  },
  celebrationRing1: {
    width: 100,
    height: 100,
    // Would animate: scale from 0.5 to 2.0, opacity from 0.8 to 0
  },
  celebrationRing2: {
    width: 100,
    height: 100,
    // Would animate: scale from 0.5 to 2.5, opacity from 0.6 to 0 (delayed)
  },
  celebrationRing3: {
    width: 100,
    height: 100,
    // Would animate: scale from 0.5 to 3.0, opacity from 0.4 to 0 (more delayed)
  },
  // Pin Point Marker Styles (Old - kept for arrived state reference)
  pinPointContainer: {
    position: 'absolute',
    top: -120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPointPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    // This would animate in production - requires Animated API
  },
  pinPoint: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 80,
    width: 60,
  },
  pinHead: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF3B30',
    borderWidth: 4,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    // Inner circle effect
    position: 'relative',
  },
  pinShaft: {
    width: 8,
    height: 30,
    backgroundColor: '#FF3B30',
    marginTop: -8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  pinShadow: {
    width: 40,
    height: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    marginTop: 4,
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
  // 3D Waypoint Styles
  waypointsContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  waypoint3D: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointSphere: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointLayer: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  waypointShadowLayer: {
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    transform: [{ scale: 1.2 }],
  },
  waypointMainLayer: {
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  waypointGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(0, 122, 255, 0.4)',
  },
  waypointDistanceText: {
    marginTop: 4,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

