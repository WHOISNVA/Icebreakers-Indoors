# 🎯 Update Your Real Venue Coordinates

## **Current Status**
✅ Your venue ID is configured: `6e41ead0-a0d4-11f0-819a-17ea3822dd94`  
⚠️ **Using placeholder coordinates** (San Francisco)  
🔧 **Need to update** with your real venue location  

## **Step 1: Get Your Real Coordinates**

### **Option A: IndoorAtlas Dashboard (Best)**
1. **Go to**: https://dashboard.indooratlas.com
2. **Log in** with your IndoorAtlas account
3. **Find your venue** (ID: `6e41ead0-a0d4-11f0-819a-17ea3822dd94`)
4. **Click on the venue** to view details
5. **Look for coordinates** in the venue information
6. **Copy the latitude and longitude**

### **Option B: Visit Your Venue**
1. **Go to your mapped venue** in person
2. **Open Google Maps** on your phone
3. **Get your current location** (should be close to your venue)
4. **Copy the coordinates** from the map

### **Option C: Use GPS Coordinates**
1. **Stand at your venue location**
2. **Open any maps app** (Google Maps, Apple Maps, etc.)
3. **Long press** on your exact location
4. **Copy the coordinates** that appear

## **Step 2: Update Your Code**

**File to edit**: `src/services/FloorPlanService.ts`

**Find this section** (around line 148-150):
```typescript
latitude: 37.7749, // ⚠️ REPLACE: Get from IndoorAtlas dashboard or GPS
longitude: -122.4194, // ⚠️ REPLACE: Get from IndoorAtlas dashboard or GPS
name: 'Your Real Mapped Venue' // ⚠️ REPLACE: Your actual venue name
```

**Replace with your real coordinates**:
```typescript
latitude: YOUR_ACTUAL_LATITUDE,    // e.g., 40.7128
longitude: YOUR_ACTUAL_LONGITUDE,  // e.g., -74.0060
name: 'Your Actual Venue Name'      // e.g., 'Downtown Office Building'
```

## **Step 3: Test the Auto-Zoom**

1. **Save the file** after updating coordinates
2. **Run your app**
3. **Switch to "Indoor Floor Plan"** mode
4. **Map should auto-zoom** to your real venue location
5. **Check console logs** - you should see your real coordinates

## **Expected Console Output**

### **Before (Placeholder):**
```
⚠️ USING PLACEHOLDER COORDINATES!
📍 Current: 37.7749, -122.4194 (San Francisco)
🔧 To fix: Update coordinates in FloorPlanService.ts
```

### **After (Real Coordinates):**
```
🌐 Fetching real venue data for: 6e41ead0-a0d4-11f0-819a-17ea3822dd94
📍 Venue location: YOUR_LAT, YOUR_LNG
🗺️ Zoomed to venue location: YOUR_LAT, YOUR_LNG
```

## **Example Coordinate Formats**

### **Decimal Degrees (Most Common)**
```
latitude: 40.7128
longitude: -74.0060
```

### **Degrees, Minutes, Seconds (Convert to Decimal)**
```
40°42'46.1"N 74°00'21.6"W
→ latitude: 40.7128, longitude: -74.0060
```

## **Troubleshooting**

### **If coordinates are wrong:**
- **Double-check** your IndoorAtlas dashboard
- **Verify** you're using the right venue ID
- **Test** with a known location first

### **If auto-zoom doesn't work:**
- **Check console logs** for error messages
- **Verify** coordinates are valid numbers
- **Ensure** latitude is between -90 and 90
- **Ensure** longitude is between -180 and 180

### **If you can't find coordinates:**
- **Contact IndoorAtlas support** for venue details
- **Use GPS coordinates** from your phone at the venue
- **Check venue documentation** if available

## **Quick Test**

To verify your coordinates are correct:

1. **Open Google Maps**
2. **Search for your coordinates** (e.g., "40.7128, -74.0060")
3. **Verify** it shows your actual venue
4. **If correct**, use those coordinates in your code

## **Benefits After Update**

✅ **Map auto-zooms** to your real venue  
✅ **Perfect for indoor navigation**  
✅ **Professional user experience**  
✅ **No manual navigation needed**  

## **Need Help?**

If you can't find your coordinates:

1. **Check IndoorAtlas dashboard** for venue details
2. **Visit your venue** and get GPS coordinates
3. **Contact IndoorAtlas support** for assistance
4. **Use the helper script**: `node get-real-venue-coordinates.js`

**Once you update the coordinates, your venue auto-zoom will work perfectly!** 🎯✨

