# Delivery Tracker App

A React Native application for tracking delivery location using `react-native-geolocation-service`. This app provides real-time location tracking for delivery drivers with a beautiful, modern UI.

## Features

- 🗺️ **Real-time Location Tracking** - Track delivery location with high accuracy
- 📱 **Cross-platform** - Works on both iOS and Android
- 🎯 **Background Location** - Continue tracking even when app is in background
- 📍 **Interactive Map** - Visual representation of current location
- 🚚 **Delivery Management** - Track delivery status and customer information
- ⚡ **High Performance** - Optimized for smooth location updates

## Prerequisites

- Node.js (v16 or higher)
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)
- Google Maps API key (for map functionality)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DeliveryTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **iOS Setup**
   ```bash
   cd ios
   pod install
   cd ..
   ```

4. **Android Setup**
   - Open `android/app/src/main/AndroidManifest.xml`
   - Add your Google Maps API key:
   ```xml
   <meta-data
     android:name="com.google.android.geo.API_KEY"
     android:value="YOUR_GOOGLE_MAPS_API_KEY"/>
   ```

5. **iOS Setup (Info.plist)**
   - Add your Google Maps API key to `ios/DeliveryTracker/Info.plist`:
   ```xml
   <key>GMSApiKey</key>
   <string>YOUR_GOOGLE_MAPS_API_KEY</string>
   ```

## Running the App

### Android
```bash
npx react-native run-android
```

### iOS
```bash
npx react-native run-ios
```

## Permissions

The app requires the following permissions:

### Android
- `ACCESS_FINE_LOCATION` - For precise location tracking
- `ACCESS_COARSE_LOCATION` - For approximate location tracking
- `ACCESS_BACKGROUND_LOCATION` - For background location tracking
- `FOREGROUND_SERVICE` - For continuous location updates
- `WAKE_LOCK` - To keep the device awake during tracking

### iOS
- `NSLocationWhenInUseUsageDescription` - Location access when app is in use
- `NSLocationAlwaysAndWhenInUseUsageDescription` - Location access always
- `NSLocationAlwaysUsageDescription` - Background location access

## Usage

1. **Start the App** - Launch the app and grant location permissions
2. **Get Current Location** - Tap "Get Location" to get your current position
3. **Start Delivery** - Tap "Start Delivery" to begin location tracking
4. **View on Map** - Your location will be displayed on the interactive map
5. **Complete Delivery** - Tap "Complete Delivery" to stop tracking

## Configuration

You can customize the location tracking settings in `src/services/LocationService.ts`:

```typescript
const config: LocationServiceConfig = {
  enableHighAccuracy: true,    // Use GPS for high accuracy
  timeout: 15000,              // Timeout in milliseconds
  maximumAge: 10000,           // Maximum age of cached location
  distanceFilter: 10,          // Minimum distance for updates (meters)
  showLocationDialog: true,    // Show location permission dialog
  forceRequestLocation: true,  // Force location request
  forceLocationManager: false, // Use location manager
  fallbackToGooglePlayServices: true, // Fallback for Android
};
```

## Project Structure

```
src/
├── components/
│   └── DeliveryTracker.tsx    # Main delivery tracking component
├── services/
│   └── LocationService.ts     # Location tracking service
├── types/
│   └── index.ts              # TypeScript type definitions
└── utils/                    # Utility functions
```

## Dependencies

- `react-native-geolocation-service` - Advanced location tracking
- `react-native-maps` - Interactive maps
- `@react-native-community/geolocation` - Location utilities
- `react-native-safe-area-context` - Safe area handling

## Troubleshooting

### Location Not Working
1. Check if location permissions are granted
2. Ensure location services are enabled on the device
3. Check if the app has background location permission
4. Verify GPS is enabled and working

### Map Not Displaying
1. Verify Google Maps API key is correctly configured
2. Check if the API key has the required permissions
3. Ensure internet connection is available

### Build Issues
1. Clean and rebuild the project
2. Clear node_modules and reinstall dependencies
3. For iOS: Clean build folder in Xcode
4. For Android: Clean gradle cache

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the repository.