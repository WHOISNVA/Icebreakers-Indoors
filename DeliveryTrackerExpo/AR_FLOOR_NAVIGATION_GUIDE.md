# 🏢 AR Floor Navigation Guide

## How It Works

The AR navigation arrow now **tilts vertically** to help you navigate between floors!

## 🎯 Arrow Behavior

### Same Floor (Blue/Green Arrow)
```
    ▲       Sharp point at top
   ████     Wide block head
   ████     Narrow block shaft
   ████     Blue = navigating / Green = aligned
```

### Target Above You (Orange Arrow Tilts UP)
```
     ▲         Sharp point
    ╱████╲     Block arrow tilts upward
   ╱ ████ ╲    Orange color
  ╱  ████  ╱   Angle = steeper when closer
 ╱   ████   ╲
────  ──  ────

Direction Text:
⬆️ GO UP 2 Floors
Bearing: 45° • 8m vertical
```

### Target Below You (Orange Arrow Tilts DOWN)
```
────  ──  ────
 ╲   ████   ╱
  ╲  ████  ╱   Block arrow tilts downward
   ╲ ████ ╱    Orange color
    ╲████╱     Angle = steeper when closer
     ████
     ▼

Direction Text:
⬇️ GO DOWN 1 Floor
Bearing: 180° • 4m vertical
```

## 📐 Tilt Angle Logic

### How Steep is the Arrow?

The arrow tilt is calculated based on **how far** you are horizontally and **how many floors** separate you:

```
Tilt Angle = arctan(vertical_distance / horizontal_distance)

Where:
- vertical_distance = floors × 4 meters
- horizontal_distance = distance shown on screen
```

### Examples

#### 1. Far Away + Multiple Floors = Gentle Tilt
```
Distance: 50m
Floors: 2 up (8m vertical)
Angle: arctan(8/50) = 9.1°

Result: Slight upward tilt
     ╱
    ▲  (gentle angle)
```

#### 2. Close + Multiple Floors = Steep Tilt
```
Distance: 10m
Floors: 2 up (8m vertical)
Angle: arctan(8/10) = 38.7°

Result: Strong upward tilt
   ╱
  ▲   (steep angle)
 ╱
```

#### 3. Very Close + Many Floors = Maximum Tilt (45°)
```
Distance: 5m
Floors: 3 up (12m vertical)
Angle: arctan(12/5) = 67° → Capped at 45°

Result: Maximum upward tilt
  ╱
 ▲    (45° angle)
╱
```

## 🎨 Color Coding

### Blue Arrow
- **Meaning**: Navigating on same floor
- **Action**: Follow the direction
- **When Green**: You're pointing the right way (< 15° off)

### Orange Arrow
- **Meaning**: Floor change needed
- **Action**: Find stairs/elevator in the direction shown
- **Never Green**: Green only appears when on same floor

## 📱 What You'll See

### Scenario: Customer 2 Floors Up, 25m Away

**Top Info Bar:**
```
📦 John's Order
48.5m

📍 You: Floor 1
🎯 Target: Floor 3
⬆️ 8.0m vertical
```

**Center:**
```
   ╱          ← Arrow tilted up ~18°
  ▲           ← Orange color
 ╱ │ ╲
───┴───
```

**Direction Text:**
```
⬆️ GO UP 2 Floors
Bearing: 45° • 8m vertical
```

### Scenario: On Same Floor, Aligned

**Center:**
```
     ▲         ← Arrow straight
     │         ← Green color (aligned)
     │
   ─────

  🎯 Straight Ahead
  Bearing: 355°
```

## 🚶 Navigation Steps

### If Customer is Above You:
1. **See orange arrow tilted UP**
2. **Follow horizontal direction** (arrow rotation)
3. **Find stairs/elevator** going up
4. **Go up** the number of floors shown
5. **Arrow turns blue** when on correct floor
6. **Continue navigation** to exact location

### If Customer is Below You:
1. **See orange arrow tilted DOWN**
2. **Follow horizontal direction** (arrow rotation)
3. **Find stairs/elevator** going down
4. **Go down** the number of floors shown
5. **Arrow turns blue** when on correct floor
6. **Continue navigation** to exact location

### If On Same Floor:
1. **See blue arrow** (or green if aligned)
2. **Follow the direction** arrow points
3. **Arrow turns green** when facing correct way
4. **Walk forward** until arrival (< 15m)
5. **See pin point marker** when arrived

## 🎓 Pro Tips

### Understanding the Tilt
- **Gentle tilt** = You're far away, focus on getting closer first
- **Steep tilt** = You're close, prioritize finding stairs NOW
- **Maximum tilt (45°)** = Very close but wrong floor, stairs should be nearby

### Floor Change Strategy
1. Don't stress about exact direction while changing floors
2. Use the **horizontal rotation** to guide you toward stairs
3. Once on correct floor, arrow becomes **blue/green** for precise navigation
4. The app knows your floor from IndoorAtlas positioning

### Accuracy
- Arrow tilt is calculated in **real-time** as you move
- Gets **steeper as you get closer** (more urgent)
- **Assumes 4m per floor** (standard commercial building)
- **IndoorAtlas provides automatic floor detection**

## ⚙️ Technical Details

### Transforms Applied
```javascript
transform: [
  { rotate: `${directionAngle}deg` },      // Horizontal rotation
  { perspective: 1000 },                    // 3D perspective
  { rotateX: `${-verticalTilt}deg` }       // Vertical tilt
]
```

### Calculation
```javascript
const verticalDistance = Math.abs(floorDifference) * 4; // 4m per floor
const tiltRadians = Math.atan(verticalDistance / horizontalDistance);
let tiltDegrees = (tiltRadians * 180) / Math.PI;
tiltDegrees = Math.min(tiltDegrees, 45); // Cap at 45°
```

### Floor Detection
- **IndoorAtlas SDK** provides automatic floor level detection
- No manual floor selection needed
- Updates in real-time as you move between floors

## 📊 Visual Examples

### Arrow at Different Distances (2 Floors Up)

**50m away:** (9° tilt)
```
     ╱
    ▲
```

**30m away:** (15° tilt)
```
    ╱
   ▲
  ╱
```

**15m away:** (28° tilt)
```
   ╱
  ▲
 ╱
```

**5m away:** (45° tilt - maximum)
```
  ╱
 ▲
╱
```

## ✅ Ready to Test!

Open the app, place an order on a different floor, and watch the arrow tilt to guide you!

---

**Created**: January 2025
**Version**: 1.0

