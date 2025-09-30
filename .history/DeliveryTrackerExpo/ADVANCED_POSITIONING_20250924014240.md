# Advanced Positioning System for Cruise Ships

This document describes the advanced positioning system implemented for accurate location tracking on cruise ships and indoor environments.

## Overview

The system provides sub-meter accuracy location tracking by fusing multiple positioning technologies:

- **Continuous High-Accuracy GNSS** - BestForNavigation with background updates
- **3D Spatial Modeling** - Venue-aware positioning with floor detection
- **AR/VIO Fusion** - Visual-inertial odometry for indoor tracking
- **BLE Beacons/UWB** - Anchor-based trilateration
- **Mesh Network** - Bar staff coordination and delivery optimization

## Architecture

### Core Services

#### 1. AdvancedLocationService
- Continuous GNSS tracking with filtering
- Kalman filtering and moving average smoothing
- Jump detection and bad fix rejection
- Background location updates with foreground service

#### 2. Spatial3DService
- 3D venue modeling with floors, zones, and obstacles
- Coordinate system transformation (geo ↔ local)
- Floor detection and zone transitions
- AR/VR coordinate helpers

#### 3. ARVIOFusionService
- Visual-inertial odometry integration
- IMU sensor fusion (accelerometer, gyroscope, magnetometer)
- QR code marker detection and relocalization
- Drift correction with GNSS

#### 4. BeaconUWBService
- BLE beacon scanning and RSSI processing
- UWB anchor distance measurements
- Multi-anchor trilateration
- QR marker positioning

#### 5. MeshNetworkService
- Peer-to-peer mesh networking
- Bar station triangulation
- Delivery route optimization
- Real-time bar proximity detection

#### 6. FusedPositioningService
- Master fusion algorithm
- Multi-source position blending
- Cruise ship motion compensation
- Indoor/outdoor mode detection

## Cruise Ship Optimizations

### Moving Platform Detection
- Analyzes IMU patterns to detect ship motion vs user motion
- Separates low-frequency ship movement from user activity
- Adjusts motion thresholds for ship environment

### GNSS Configuration
```typescript
{
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 500-1000, // Continuous updates
  distanceInterval: 0,    // No distance filtering
  activityType: Location.ActivityType.OtherNavigation, // Ship-optimized
}
```

### Motion Compensation
- Platform motion filtering prevents false walking detection
- Dynamic Kalman filter process noise for ship movement
- Ship heading and speed integration

## Accuracy Improvements

### Multi-Layer Filtering
1. **Quality Check** - Reject readings with poor accuracy (>15-20m)
2. **Jump Detection** - Detect unrealistic position changes
3. **Kalman Filter** - Smooth position estimates over time
4. **Moving Average** - Reduce noise with weighted averaging
5. **Stationary Lock** - Lock position when user is stationary

### Indoor Positioning
- Visual-inertial odometry for precise relative positioning
- QR code anchors for absolute position correction
- BLE beacon trilateration for room-level accuracy
- UWB ranging for sub-meter precision

### Mesh Network Benefits
- Multiple perspective triangulation
- Bar staff device coordination
- Real-time position sharing
- Delivery route optimization

## Usage

### Basic Integration
```typescript
import EnhancedMotionService from './services/EnhancedMotionService';

const motionService = new EnhancedMotionService({
  onPositionUpdate: (position) => {
    console.log(`Position: ${position.accuracy.toFixed(2)}m accuracy`);
    console.log(`Sources: ${position.sources.map(s => s.type).join(', ')}`);
  },
  onAccuracyImproved: (accuracy) => {
    console.log(`Accuracy improved to ${accuracy.toFixed(2)}m`);
  },
  targetAccuracy: 1.0, // 1 meter target
  enableAdvancedPositioning: true
});

await motionService.startEnhancedMonitoring();
```

### Advanced Usage
```typescript
import FusedPositioningService from './services/FusedPositioningService';

const positioning = new FusedPositioningService({
  venueId: 'cruise_ship_deck_7',
  cruiseShipMode: true,
  targetAccuracy: 0.5, // 50cm target
  onPositionUpdate: (position) => {
    if (position.metadata.cruiseMode) {
      // Handle cruise ship specific logic
    }
    if (position.metadata.indoorMode) {
      // Enhanced indoor features
    }
  }
});

await positioning.startFusedPositioning();

// Get delivery optimization
const optimization = positioning.optimizeDeliveryRoute('customer_123');
console.log(`Recommended bar: ${optimization.recommendedBar}`);
```

## Configuration

### Venue Model Setup
```typescript
const venueModel = {
  id: 'cruise_ship_venue',
  name: 'Cruise Ship - Deck 7',
  coordinateSystem: {
    origin: { latitude: 25.7612, longitude: -80.1923, altitude: 25 },
    rotation: 0, // degrees from north
    scale: 1.0   // meters per unit
  },
  floors: [{
    level: 7,
    elevation: 25, // meters above sea level
    zones: [
      {
        id: 'main_bar',
        type: 'bar',
        polygon: [/* 3D coordinates */]
      }
    ]
  }]
};
```

### Beacon Anchor Setup
```typescript
const beaconAnchors = [
  {
    id: 'bar_main_beacon',
    uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
    major: 1, minor: 1,
    position: { x: 0, y: 0, z: 2.5 },
    type: 'ibeacon'
  }
];
```

## Performance Metrics

### Expected Accuracy
- **Outdoor (GNSS)**: 2-5 meters
- **Indoor (Beacons)**: 1-3 meters  
- **Indoor (UWB)**: 0.3-1 meter
- **Indoor (VIO)**: 0.1-0.5 meters (relative)
- **Fused**: 0.5-2 meters (depending on environment)

### Update Rates
- **GNSS**: 1-2 Hz continuous
- **IMU**: 60 Hz
- **Beacons**: 1 Hz
- **UWB**: 2-5 Hz
- **Fusion**: 1 Hz

## Deployment Notes

### Required Permissions
- Location (foreground and background)
- Bluetooth (scanning and connecting)
- Camera (for QR codes and VIO)

### Hardware Requirements
- GPS/GNSS receiver
- IMU sensors (accelerometer, gyroscope, magnetometer)
- Bluetooth 4.0+ for BLE beacons
- UWB chip (iPhone 11+ or Android with UWB support)
- Camera (for visual positioning)

### Network Infrastructure
- BLE beacons placed every 10-15 meters
- UWB anchors for high-precision zones
- WiFi access points for mesh networking
- QR code markers at known positions

### Bar Staff Integration
- Tablets/computers with positioning service
- Mesh network participation
- Order proximity notifications
- Delivery route suggestions

## Troubleshooting

### Poor GNSS Accuracy
- Check for metallic structures interfering with signals
- Ensure clear sky view when possible
- Verify ship's GPS antenna positioning

### Indoor Positioning Issues
- Verify beacon battery levels and placement
- Check QR code marker visibility and positioning
- Ensure sufficient visual features for VIO

### Mesh Network Problems
- Verify WiFi connectivity
- Check firewall settings for peer-to-peer communication
- Ensure all devices are on same network segment

## Future Enhancements

- Machine learning for motion pattern recognition
- Integration with ship's navigation system
- Advanced AR features for staff guidance
- Predictive delivery optimization
- Integration with ship's WiFi positioning system
