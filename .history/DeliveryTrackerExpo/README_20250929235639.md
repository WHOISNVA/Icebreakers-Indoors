# Delivery Tracker Expo

A React Native Expo application for tracking drink deliveries with real-time location updates.

## Features

- **Customer Interface**: Order drinks and update location
- **Bartender Interface**: View and manage incoming orders
- **Real-time Updates**: Firebase Realtime Database integration
- **Location Tracking**: GPS-based location with motion detection
- **Interactive Maps**: View order locations on a map
- **Professional UI**: Modern, clean interface with status indicators

## Advanced Positioning Features (Requires Custom Build)

The app includes an advanced positioning system for high-accuracy indoor/outdoor tracking:

- **UWB (Ultra-Wideband)**: Sub-meter accuracy with iPhone U1/U2 chips
- **BLE Beacon Trilateration**: Indoor positioning with Bluetooth beacons
- **Visual-Inertial Odometry**: ARKit/ARCore sensor fusion
- **3D Venue Mapping**: Multi-floor navigation with zones
- **Cruise Ship Mode**: Specialized tracking for maritime environments
- **Mesh Networking**: Phone-to-phone coordination for optimal routing

**Note**: These features require native modules not available in Expo Go. See [NATIVE_MODULES_SETUP.md](./NATIVE_MODULES_SETUP.md) for instructions on building a custom development client.

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your mobile device (for basic features)
- Xcode/Android Studio (for advanced features)

### Installation
