# Get Your Venue Coordinates

## How to Find Your Venue Location

To get the actual coordinates for your venue ID `6e41ead0-a0d4-11f0-819a-17ea3822dd94`, you have a few options:

### Option 1: IndoorAtlas Dashboard
1. **Log into your IndoorAtlas account**
2. **Go to your venue** (ID: `6e41ead0-a0d4-11f0-819a-17ea3822dd94`)
3. **Check the venue details** - coordinates should be displayed
4. **Copy the latitude and longitude**

### Option 2: Use Your Phone's Location
1. **Go to your mapped venue** in person
2. **Open a maps app** (Google Maps, Apple Maps)
3. **Get your current location** - this should be close to your venue
4. **Copy the coordinates**

### Option 3: IndoorAtlas API (Advanced)
```bash
# Use IndoorAtlas API to get venue info
curl -X GET "https://api.indooratlas.com/v1/venues/6e41ead0-a0d4-11f0-819a-17ea3822dd94" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Update Your Coordinates

Once you have your venue coordinates, update the FloorPlanService:

**File: `src/services/FloorPlanService.ts`**

Find this section (around line 186-189):
```typescript
venueLocation: {
  latitude: 37.7749, // Replace with your actual venue coordinates
  longitude: -122.4194, // Replace with your actual venue coordinates
  name: 'Your Mapped Venue'
}
```

Replace with your actual coordinates:
```typescript
venueLocation: {
  latitude: YOUR_ACTUAL_LATITUDE, // e.g., 40.7128
  longitude: YOUR_ACTUAL_LONGITUDE, // e.g., -74.0060
  name: 'Your Actual Venue Name'
}
```

## Test the Zoom Feature

After updating the coordinates:

1. **Switch to "Indoor Floor Plan"** mode
2. **The map should automatically zoom** to your venue location
3. **Check the console logs** for:
   ```
   🗺️ Zoomed to venue location: YOUR_LAT, YOUR_LNG
   📍 Set venue location: YOUR_LAT, YOUR_LNG
   ```

## Expected Behavior

- **Map automatically centers** on your venue
- **Zoom level is optimized** for indoor navigation (0.01 degree span)
- **Smooth animation** when zooming to location
- **Console logs** confirm the zoom action

## Troubleshooting

If the map doesn't zoom to your location:

1. **Check coordinates** are correct (latitude: -90 to 90, longitude: -180 to 180)
2. **Verify venue ID** matches your IndoorAtlas venue
3. **Check console logs** for error messages
4. **Ensure IndoorAtlas is enabled** in your .env file

## Example Coordinates

Here are some example coordinates for reference:

```typescript
// San Francisco, CA
latitude: 37.7749, longitude: -122.4194

// New York, NY  
latitude: 40.7128, longitude: -74.0060

// London, UK
latitude: 51.5074, longitude: -0.1278

// Tokyo, Japan
latitude: 35.6762, longitude: 139.6503
```

Replace the example coordinates with your actual venue location!
