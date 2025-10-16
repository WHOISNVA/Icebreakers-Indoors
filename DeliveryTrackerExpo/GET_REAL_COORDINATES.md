# Get Your Real Venue Coordinates

## 🎯 **Current Status**
Your venue ID `6e41ead0-a0d4-11f0-819a-17ea3822dd94` is configured, but we need your actual venue coordinates to enable auto-zoom.

## 📍 **How to Get Your Real Coordinates**

### **Option 1: IndoorAtlas Dashboard (Recommended)**

1. **Go to IndoorAtlas Dashboard**
   - Visit: https://dashboard.indooratlas.com
   - Log in with your account

2. **Find Your Venue**
   - Look for venue ID: `6e41ead0-a0d4-11f0-819a-17ea3822dd94`
   - Click on the venue to view details

3. **Get Coordinates**
   - Look for "Location" or "Coordinates" section
   - Copy the latitude and longitude values
   - Note the venue name

### **Option 2: Visit Your Venue**

1. **Go to your mapped venue** in person
2. **Open Google Maps or Apple Maps**
3. **Get your current location** (should be close to your venue)
4. **Copy the coordinates**

### **Option 3: Use the Helper Script**

```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
node get-real-venue-coordinates.js
```

## 🔧 **Update Your Code**

Once you have your coordinates, update this file:

**File: `src/services/FloorPlanService.ts`**

Find this section (around line 144-149):
```typescript
venueLocation: {
  // TODO: Replace with your actual venue coordinates from IndoorAtlas dashboard
  latitude: 37.7749, // Get this from your IndoorAtlas venue details
  longitude: -122.4194, // Get this from your IndoorAtlas venue details
  name: 'Your Real Mapped Venue'
}
```

Replace with your actual coordinates:
```typescript
venueLocation: {
  latitude: YOUR_ACTUAL_LATITUDE,    // e.g., 40.7128
  longitude: YOUR_ACTUAL_LONGITUDE,   // e.g., -74.0060
  name: 'Your Actual Venue Name'      // e.g., 'Downtown Office Building'
}
```

## 🧪 **Test the Auto-Zoom**

After updating the coordinates:

1. **Run your app**
2. **Switch to "Indoor Floor Plan"** mode
3. **Map should auto-zoom** to your venue location
4. **Check console logs** for:
   ```
   🌐 Fetching real venue data for: 6e41ead0-a0d4-11f0-819a-17ea3822dd94
   📍 Venue location: YOUR_LAT, YOUR_LNG
   🗺️ Zoomed to venue location: YOUR_LAT, YOUR_LNG
   ```

## 📋 **Expected Behavior**

### **Before (Placeholder Coordinates):**
- Map zooms to San Francisco (37.7749, -122.4194)
- Not your actual venue location

### **After (Real Coordinates):**
- Map zooms to your actual mapped venue
- Perfect for indoor navigation
- Shows your real building location

## 🔍 **Troubleshooting**

### **If coordinates are wrong:**
1. **Double-check** your IndoorAtlas dashboard
2. **Verify** the venue ID is correct
3. **Test** with a known location first

### **If auto-zoom doesn't work:**
1. **Check console logs** for error messages
2. **Verify** coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)
3. **Ensure** IndoorAtlas is enabled in your .env

### **If you can't find coordinates:**
1. **Contact IndoorAtlas support** for your venue details
2. **Use GPS coordinates** from your phone at the venue
3. **Check venue documentation** if available

## 📱 **Quick Test**

To test if your coordinates are correct:

1. **Open Google Maps**
2. **Search for your coordinates** (e.g., "37.7749, -122.4194")
3. **Verify** it shows your actual venue
4. **If correct**, use those coordinates in your code

## 🎉 **Once Updated**

Your app will:
- ✅ **Auto-zoom** to your real venue location
- ✅ **Show correct building** on the map
- ✅ **Perfect zoom level** for indoor navigation
- ✅ **Professional user experience**

**Get your coordinates and update the code - your venue auto-zoom will work perfectly!** 🗺️✨

