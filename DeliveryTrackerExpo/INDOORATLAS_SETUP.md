# 🏢 IndoorAtlas Integration Guide

## Overview
Your app now supports **IndoorAtlas** for sub-meter indoor positioning accuracy! This provides:
- ✅ **1-2 meter accuracy** indoors (vs 5-50m with GPS)
- ✅ **Automatic floor detection** (no altitude calculations needed)
- ✅ **Better heading/orientation** for AR navigation
- ✅ **Automatic GPS fallback** if not configured

## Setup Steps

### 1. Create IndoorAtlas Account
1. Go to https://app.indooratlas.com
2. Sign up for a free account
3. You'll get access to the dashboard

### 2. Create Your Venue
1. In the IndoorAtlas dashboard, click **"Create New Venue"**
2. Enter venue details:
   - Name: e.g., "Caesar's Palace Casino"
   - Address: Your venue address
3. Upload floor plans (optional but recommended)

### 3. Map Your Venue
**Important**: This step is required for IndoorAtlas to work!

#### Option A: Use IndoorAtlas MapCreator App (Recommended)
**⚠️ Android Only** - MapCreator is currently only available for Android devices.

1. Download **IndoorAtlas MapCreator 2** from Google Play Store
2. Open the app and sign in with your IndoorAtlas account
3. Select your venue
4. Walk around your venue to collect magnetic field data:
   - Walk along corridors
   - Walk through rooms
   - Cover the entire delivery area
   - Spend ~30-60 minutes for best results
5. Upload the mapping data to the cloud

**If You Only Have iOS:**
- **Borrow an Android device** for mapping (one-time setup)
- **Use venue staff's Android phone** (Samsung, Google Pixel, etc.)
- **Check if venue is pre-mapped** (some casinos/hotels may already be in IndoorAtlas database)
- **Contact IndoorAtlas** - they may offer professional mapping services

#### Option B: Use Pre-mapped Venues
Some large venues (casinos, hotels, malls) may already be mapped in the IndoorAtlas database. Check with IndoorAtlas support.

#### Option C: Professional Mapping Service
IndoorAtlas offers professional mapping services for commercial clients. Contact: sales@indooratlas.com

#### Testing on iOS
Once the venue is mapped (using Android), you can:
- Download **IndoorAtlas Positioning App** from iOS App Store
- Test positioning accuracy on your iPhone
- Deploy your delivery app to iPhone users

### 4. Get API Credentials
1. In the IndoorAtlas dashboard, go to **"Keys"**
2. Create a new API key
3. Copy your:
   - **API Key** (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - **API Secret** (looks like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### 5. Configure the App
1. Open `/DeliveryTrackerExpo/src/config/indooratlas.ts`
2. Replace the placeholder values:
   ```typescript
   export const INDOORATLAS_CONFIG = {
     API_KEY: 'YOUR_API_KEY_HERE',      // Paste your API key
     API_SECRET: 'YOUR_API_SECRET_HERE', // Paste your API secret
     ENABLED: true,                      // Set to true
   };
   ```

### 6. Rebuild the App
```bash
cd DeliveryTrackerExpo
npx expo prebuild --clean
npx pod-install   # iOS only
npx expo run:ios  # or npx expo run:android
```

## How It Works

### Automatic Positioning
The app automatically uses the best available positioning:
```
IndoorAtlas configured? → Use IndoorAtlas (1-2m accuracy)
                     ↓
            Not configured → Use GPS (5-50m accuracy)
```

### Floor Detection
- **With IndoorAtlas**: Automatic, accurate floor detection
- **Without IndoorAtlas**: GPS altitude-based estimation (less accurate)

### AR Navigation
- **With IndoorAtlas**: Sub-meter tracking, smooth AR arrows
- **Without IndoorAtlas**: GPS-based (works but less precise)

## Testing

### Test Indoor Accuracy
1. Place an order from a known location
2. Check the console logs:
   ```
   📍 Position from INDOORATLAS: lat=..., lng=..., accuracy=1.2m
   🏢 IndoorAtlas detected floor: 3
   ```
3. Verify the floor number is correct
4. Start AR navigation and check accuracy

### Test GPS Fallback
1. Disable IndoorAtlas in config (`ENABLED: false`)
2. Place an order - should use GPS
3. Console logs will show:
   ```
   📍 Position from GPS: lat=..., lng=..., accuracy=10.5m
   🏢 Auto-calibrated floor from altitude: 3
   ```

## Troubleshooting

### "IndoorAtlas native module not available"
- Run `npx expo prebuild --clean`
- Check that package is installed: `npm list react-native-indoor-atlas`
- Android only: Check `android/build.gradle` has the Maven repository

### "IndoorAtlas initialization failed"
- Check API credentials in `indooratlas.ts`
- Verify your account is active at https://app.indooratlas.com
- Check internet connection

### Poor Accuracy
- **Venue not mapped**: Map your venue using MapCreator app
- **Incomplete mapping**: Add more data points
- **Magnetic interference**: Metal structures, elevators can affect accuracy
- **WiFi required**: Ensure device has WiFi enabled (even without internet)

### Floor Detection Wrong
- **With IndoorAtlas**: Remap the venue with better floor coverage
- **Without IndoorAtlas**: Use the "🏢 Floor Cal." button to calibrate

## Performance Comparison

| Feature | GPS Only | With IndoorAtlas |
|---------|----------|------------------|
| Indoor Accuracy | 5-50m | 1-2m |
| Floor Detection | Estimated (~1 floor error) | Exact |
| Update Rate | 1-3 seconds | 0.5-1 second |
| Heading Accuracy | ±20° | ±5° |
| Battery Impact | Low | Medium |

## Cost

- **Free Tier**: 10,000 position updates/month
- **Pro**: ~$99-299/month (recommended for production)
- **Enterprise**: Custom pricing for high-traffic venues

For a casino/hotel delivery service, Pro or Enterprise tier is recommended.

## Support

- **IndoorAtlas Docs**: https://docs.indooratlas.com
- **Community**: https://community.indooratlas.com
- **Support**: support@indooratlas.com

## Next Steps

1. **Map your venue** (most important!)
2. **Add API credentials** to config
3. **Test in your venue**
4. **Compare with GPS fallback**
5. **Decide if accuracy improvement is worth the cost**

---

**Note**: The app works perfectly fine without IndoorAtlas using GPS fallback. IndoorAtlas is an optional enhancement for professional deployments requiring sub-meter accuracy.

