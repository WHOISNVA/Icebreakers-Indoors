# Native Modules Setup for Advanced Positioning

This guide explains how to set up native modules for UWB, BLE beacons, and other advanced positioning features that aren't available in Expo Go.

## Overview

The advanced positioning system requires native modules for:
- **UWB (Ultra-Wideband)** - iPhone U1/U2 chip access
- **BLE Beacon Scanning** - Full Bluetooth LE capabilities
- **Background Location** - Continuous tracking
- **ARKit/ARCore** - Visual-Inertial Odometry

## Prerequisites

- Xcode 14+ (for iOS)
- Android Studio (for Android)
- CocoaPods installed
- React Native development environment set up

## Step 1: Prebuild Your Expo Project

```bash
# Create native iOS and Android directories
npx expo prebuild

# This generates:
# - ios/ directory with Xcode project
# - android/ directory with Android project
```

## Step 2: Install Native UWB Libraries

### For iOS (iPhone 11+ with U1/U2 chip)

1. Install the UWB library:
```bash
cd ios
pod install
```

2. Add to your `Podfile`:
```ruby
pod 'NearbyInteraction', :modular_headers => true
```

3. Add to `Info.plist`:
```xml
<key>NSNearbyInteractionAllowOnceUsageDescription</key>
<string>This app uses UWB for precise indoor positioning</string>
<key>NSNearbyInteractionUsageDescription</key>
<string>This app uses UWB to track your location for delivery services</string>
```

### For Android (devices with UWB support)

Add to `android/app/build.gradle`:
```gradle
dependencies {
    implementation 'androidx.core.uwb:uwb:1.0.0-alpha05'
}
```

## Step 3: Install BLE Beacon Libraries

### For iOS

1. Install beacon library:
```bash
npm install react-native-beacons-manager
cd ios && pod install
```

2. Add to `Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to detect nearby beacons</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app uses your location for delivery tracking</string>
```

### For Android

Add permissions to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

## Step 4: Create Native Module Bridges

### UWB Bridge for iOS

Create `ios/UWBModule.swift`:
```swift
import NearbyInteraction
import React

@objc(UWBModule)
class UWBModule: NSObject {
  private var session: NISession?
  
  @objc
  func startUWBSession(_ anchors: NSArray,
                       resolver: @escaping RCTPromiseResolveBlock,
                       rejecter: @escaping RCTPromiseRejectBlock) {
    // Implementation for UWB session
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
```

### Bridge Header

Create `ios/UWBModule.m`:
```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(UWBModule, NSObject)

RCT_EXTERN_METHOD(startUWBSession:(NSArray *)anchors
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

## Step 5: Update TypeScript Services

Update `UWBPrecisionService.ts` to use the native module:

```typescript
import { NativeModules } from 'react-native';

const { UWBModule } = NativeModules;

// In your service:
if (UWBModule) {
  // Use native UWB
  await UWBModule.startUWBSession(anchors);
} else {
  // Fallback for unsupported devices
  console.warn('UWB not available on this device');
}
```

## Step 6: Build Custom Development Client

### For iOS
```bash
npx expo run:ios
```

### For Android
```bash
npx expo run:android
```

## Step 7: Testing

1. **Physical Device Required**: UWB and BLE features require real devices
2. **iPhone Requirements**: iPhone 11 or newer for UWB
3. **Android Requirements**: Devices with UWB chipset (Samsung Galaxy Note 20+, Pixel 6 Pro+)

## Troubleshooting

### Common Issues

1. **"UWB not available"**
   - Ensure device supports UWB
   - Check iOS version (14.0+)
   - Verify permissions granted

2. **BLE Scanning Issues**
   - Check Bluetooth is enabled
   - Verify location permissions
   - Ensure beacons are powered on

3. **Build Errors**
   - Clean build: `cd ios && rm -rf Pods && pod install`
   - Reset Metro: `npx react-native start --reset-cache`

## Alternative: EAS Build

For production, use EAS Build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure your project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Resources

- [Expo Custom Development Builds](https://docs.expo.dev/development/build/)
- [Apple Nearby Interaction](https://developer.apple.com/documentation/nearbyinteraction)
- [Android UWB API](https://developer.android.com/guide/topics/connectivity/uwb)
- [React Native Beacons Manager](https://github.com/MacKentoch/react-native-beacons-manager)

## Next Steps

After setting up native modules:
1. Test UWB ranging with physical anchors
2. Configure BLE beacon UUIDs
3. Implement background location handling
4. Test AR/VIO features with ARKit/ARCore
