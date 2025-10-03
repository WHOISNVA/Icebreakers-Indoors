# 🏢 Floor/Altitude Tracking Feature

## Overview
The app now tracks **altitude and floor level** for more precise indoor navigation in multi-story buildings (hotels, casinos, resorts, etc.).

## How It Works

### 1. **Altitude Capture**
When a user places an order, the app captures:
- **Latitude & Longitude** (horizontal position)
- **Altitude** (meters above sea level)
- **Floor Number** (estimated from altitude)

### 2. **Floor Estimation**
The app estimates floor numbers using a simple algorithm:
```typescript
Floor Number = Round(altitude / 3 meters)
```

- **Ground Floor** = 0
- **1st Floor** = 1
- **2nd Floor** = 2, etc.

Assumes ~3 meters (10 feet) per floor (industry standard).

### 3. **Display Format**
- Ground Floor
- 1st Floor
- 2nd Floor
- 3rd Floor
- 4th Floor, etc.

## Where Floor Info Appears

### 📱 Bartender Screen
**Order Cards** show floor for both:
- **Origin location** (where order was placed)
- **Current location** (if customer moved)

Example:
```
From: 36.114647, -115.172813 (±10m) • 2nd Floor
Current: 36.114650, -115.172820 (±8m) • 2nd Floor
```

### 🗺️ Map View
The status overlay shows:
```
Order ord_1234567890
📍 Poolside Bar
🏢 2nd Floor
Distance: 25m
```

### 📹 AR Navigation View
The AR camera overlay displays:
```
📍 You: Ground Floor
🎯 Target: 2nd Floor
⬆️ 6.0m vertical
```

**Features:**
- Shows **your current floor** and **target floor**
- Shows **vertical distance** (in meters)
- Shows **direction arrow** (⬆️ up or ⬇️ down)
- Highlights vertical distance in **orange** when > 1 meter

## Benefits

### ✅ For Bartenders/Servers
1. **Know the exact floor** before starting delivery
2. **Navigate vertically** (elevators/stairs) with confidence
3. **Avoid wrong-floor deliveries** in large buildings
4. **Faster service** with precise location

### ✅ For Customers
1. **More accurate tracking** of server location
2. **Better ETAs** (accounts for vertical distance)
3. **Less confusion** in multi-story venues

## Technical Details

### Data Structure
```typescript
interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number | null;        // meters above sea level
  altitudeAccuracy?: number | null; // accuracy in meters
  floor?: number | null;            // estimated floor number
  // ... other fields
}
```

### Location Accuracy
- Uses **`Location.Accuracy.BestForNavigation`**
- Typically provides altitude accuracy of **±3-10 meters**
- More accurate indoors with WiFi/cellular triangulation
- GPS altitude can be noisy but is smoothed over time

### Distance Calculations
The app calculates **3D distance** (not just horizontal):
```typescript
3D Distance = √(horizontal² + vertical²)
```

This gives the **true straight-line distance** including elevation changes.

### Utility Functions
```typescript
// Estimate floor from altitude
estimateFloor(altitude: number, groundAltitude?: number): number

// Format floor for display
formatFloor(floor: number): string

// Calculate vertical distance
calculateVerticalDistance(alt1: number, alt2: number): number

// Calculate 3D distance
calculate3DDistance(lat1, lon1, alt1, lat2, lon2, alt2): number
```

## Use Cases

### 🏨 Hotel Delivery
- Order from **5th floor room**
- Server sees "5th Floor" before leaving
- AR navigation shows elevator/stairs needed

### 🎰 Casino Multi-Level
- Order from **casino floor** (ground)
- Or from **mezzanine** (1st floor)
- Or from **rooftop bar** (top floor)

### 🏊 Pool Complex
- **Pool level** vs **Club level**
- **Cabana** (ground) vs **Skybox** (elevated)

### 🏟️ Stadium/Arena
- **Section 100** (ground) vs **Section 300** (upper deck)
- Bartender knows to use **ramp** or **elevator**

## Limitations

### 📍 GPS Altitude Accuracy
- **Outdoor:** ±3-5 meters (good)
- **Indoor:** ±5-15 meters (moderate)
- **Deep Indoor:** May be unreliable

### 🏢 Floor Height Variations
- Standard assumption: **3 meters per floor**
- Some buildings have higher ceilings (lobbies, atriums)
- May need **calibration** for specific venues

### 📶 Device Capabilities
- Older devices may not provide altitude
- Barometer-equipped devices (iPhone 6+) are more accurate
- Falls back gracefully when altitude unavailable

## Future Enhancements

### 🎯 Potential Improvements
1. **Manual floor selection** (let users pick floor)
2. **Building-specific calibration** (custom floor heights)
3. **Barometer integration** (more accurate indoor altitude)
4. **Floor plan overlays** (show building layout)
5. **Elevator/stairs routing** (suggest best vertical path)

## Testing

### How to Test Floor Tracking
1. **Place order** on different floors
2. Check **order card** shows floor number
3. Open **Map View** - verify floor in status
4. Open **AR View** - verify floor comparison
5. Move between floors and observe updates

### Best Testing Locations
- Multi-story buildings
- Outdoor with elevation changes
- Stairwells (watch floor update)
- Elevators (watch floor change)

---

**Note:** Floor tracking enhances the existing lat/long precision for complete 3D positioning! 🎯📍



