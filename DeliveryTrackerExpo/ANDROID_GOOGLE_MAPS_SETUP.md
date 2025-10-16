# Android Google Maps Setup Required

## Problem
The app crashes when clicking the "Navigate" button because `react-native-maps` on Android requires a Google Maps API key, which is currently missing.

## Solution

### Step 1: Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable "Maps SDK for Android":
   - Go to "APIs & Services" → "Library"
   - Search for "Maps SDK for Android"
   - Click "Enable"
4. Create an API Key:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy your API key

### Step 2: Add the API Key to AndroidManifest.xml

The placeholder has already been added at line 40:

```xml
<meta-data android:name="com.google.android.geo.API_KEY" android:value="YOUR_GOOGLE_MAPS_API_KEY_HERE"/>
```

**Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` with your actual Google Maps API key.**

File location: `/android/app/src/main/AndroidManifest.xml`

### Step 3: Rebuild the App

After adding your API key, rebuild and reinstall the app:

```bash
cd android
./gradlew clean
./gradlew assembleDebug
./gradlew installDebug
```

Or use:
```bash
npx expo run:android
```

### Step 4: Test

1. Open the app
2. Switch to "Bar" tab
3. Create an order (or use existing order)
4. Click "Navigate" button
5. Map should now open successfully!

## Alternative: Use Expo Maps (No API Key Required for Development)

If you want to avoid setting up Google Maps API key for now, you could switch to using Expo's built-in maps which work better in development. However, for production, Google Maps API key is recommended.

## Current Status

- ✅ AndroidManifest.xml updated with placeholder
- ✅ Error handling added to prevent crashes
- ⏳ Waiting for Google Maps API key to be added
- ⏳ Rebuild required after adding key

## Files Modified

1. `/android/app/src/main/AndroidManifest.xml` - Added Google Maps API key meta-data
2. `/src/screens/BartenderScreen.tsx` - Added error handling for map crashes
3. `/src/services/DeliveryTrackingService.ts` - Added null safety for server location

