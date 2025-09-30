# Advanced Positioning System for Delivery Tracking

This document describes the advanced positioning system implemented for accurate location tracking in the delivery tracking application, supporting both indoor and outdoor environments including cruise ships, bars, restaurants, and other venues.

## Overview

The system provides sub-meter accuracy location tracking by fusing multiple positioning technologies:

- **Continuous High-Accuracy GNSS** - BestForNavigation with background updates
- **3D Spatial Modeling** - Venue-aware positioning with floor detection
- **AR/VIO Fusion** - Visual-inertial odometry for indoor tracking
- **BLE Beacons/UWB** - Anchor-based trilateration
- **Mesh Network** - Phone-based mesh networking and delivery optimization

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
- Visual feature tracking for relative positioning
- Drift correction with GNSS

#### 4. BeaconUWBService
- BLE beacon scanning and RSSI processing
- UWB anchor distance measurements
- Multi-anchor trilateration

#### 5. MeshNetworkService
- Phone-based mesh networking
- Bar station coordination
- Delivery route optimization
- Real-time proximity detection between phones and bars

#### 6. FusedPositioningService
- Master fusion algorithm
- Multi-source position blending
- Cruise ship motion compensation
- Indoor/outdoor mode detection

## Venue-Specific Optimizations

### Moving Platform Detection (Cruise Ships)
- Analyzes IMU patterns to detect ship motion vs user movement
- Separates low-frequency ship movement from user activity
- Adjusts motion thresholds for maritime environments

### Indoor Venue Optimization (Bars/Restaurants)
- Enhanced BLE beacon coverage for precise room-level positioning
- Zone-based positioning for different venue areas (bar, seating, kitchen)
- Staff device coordination for efficient order delivery

### GNSS Configuration
```typescript
{
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 500-1000, // Continuous updates
  distanceInterval: 0,    // No distance filtering
  activityType: Location.ActivityType.OtherNavigation, // Optimized for various venues
}
```

### Motion Compensation
- Platform motion filtering prevents false walking detection on moving venues (cruise ships)
- Dynamic Kalman filter process noise adaptation for different environments
- Venue-specific motion pattern recognition and compensation

## Accuracy Improvements

### Multi-Layer Filtering
1. **Quality Check** - Reject readings with poor accuracy (>15-20m)
2. **Jump Detection** - Detect unrealistic position changes
3. **Kalman Filter** - Smooth position estimates over time
4. **Moving Average** - Reduce noise with weighted averaging
5. **Stationary Lock** - Lock position when user is stationary

### Indoor Positioning
- Visual-inertial odometry for precise relative positioning
- Phone-based mesh triangulation for position coordination
- BLE beacon trilateration for room-level accuracy
- UWB ranging for sub-meter precision

### Mesh Network Benefits
- Phone-to-phone position triangulation
- Bar staff device coordination
- Real-time position sharing between customer phones and bar systems
- Delivery route optimization based on phone proximity

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
  id: 'venue_example',
  name: 'Sample Venue - Main Floor',
  coordinateSystem: {
    origin: { latitude: 25.7612, longitude: -80.1923, altitude: 25 },
    rotation: 0, // degrees from north
    scale: 1.0   // meters per unit
  },
  floors: [{
    level: 1,
    elevation: 0, // meters above reference level
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
- WiFi access points for phone mesh networking
- Customer phones acting as mobile beacons

### Bar Staff Integration
- Tablets/computers with positioning service
- Mesh network participation
- Order proximity notifications
- Delivery route suggestions

## Troubleshooting

### Poor GNSS Accuracy
- Check for metallic structures interfering with signals
- Ensure clear sky view when possible
- Verify venue's GPS reception (especially important on ships or in dense urban areas)

### Indoor Positioning Issues
- Verify beacon battery levels and placement
- Check phone mesh network connectivity
- Ensure sufficient visual features for VIO
- Verify phone-to-phone BLE communication

### Mesh Network Problems
- Verify WiFi connectivity
- Check firewall settings for peer-to-peer communication
- Ensure all devices are on same network segment

## Future Enhancements

- Machine learning for motion pattern recognition across different venue types
- Integration with venue management systems (ship navigation, POS systems)
- Advanced AR features for staff guidance and customer wayfinding
- Predictive delivery optimization based on historical data
- Integration with venue-specific positioning systems (WiFi, existing beacon networks)
- Multi-venue coordination for chain restaurants/bars
- Real-time crowd density and queue management
