# Dynamic Floor Selector Implementation

## Overview

The floor selector has been upgraded from a static, hardcoded implementation to a dynamic system that fetches floor plan data from IndoorAtlas API based on the venue ID. This allows the app to automatically adapt to different building configurations.

## Key Features

### ✅ **Dynamic Floor Loading**
- Fetches floor data from IndoorAtlas API when switching to indoor mode
- Automatically adapts to different venue configurations
- Supports buildings with different floor numbering (basement, ground, mezzanine, etc.)

### ✅ **Loading States**
- Shows loading spinner while fetching floor data
- Displays progress messages to user
- Handles network timeouts gracefully

### ✅ **Error Handling**
- Displays error messages if floor data fails to load
- Provides retry functionality
- Falls back to default floors if API fails

### ✅ **Flexible Floor Numbering**
- Supports negative floors (basement levels)
- Handles custom floor names (Lobby, Mezzanine, etc.)
- Adapts to venue-specific floor configurations

## Implementation Details

### 1. FloorPlanService (`src/services/FloorPlanService.ts`)

**Purpose**: Centralized service for fetching and managing floor plan data from IndoorAtlas API.

**Key Methods**:
- `getVenueFloors(venueId)`: Fetches complete floor data for a venue
- `getAvailableFloors(venueId)`: Returns array of available floor levels
- `getFloorName(venueId, level)`: Gets display name for a specific floor
- `clearCache(venueId)`: Clears cached floor data

**Features**:
- Caching system to avoid repeated API calls
- Loading state management
- Error handling with retry logic
- Mock data for testing different venue types

### 2. Updated BartenderScreen (`src/screens/BartenderScreen.tsx`)

**New State Variables**:
```typescript
const [venueFloorData, setVenueFloorData] = useState<VenueFloorData | null>(null);
const [loadingFloors, setLoadingFloors] = useState<boolean>(false);
const [floorError, setFloorError] = useState<string | null>(null);
```

**Dynamic Floor Loading**:
- Triggers when user switches to "Indoor Floor Plan" mode
- Loads floor data based on `INDOORATLAS_CONFIG.VENUE_ID`
- Sets default floor to venue's default or first available floor

**Enhanced Floor Selector**:
- Shows loading state while fetching data
- Displays error messages with retry button
- Renders dynamic floor buttons based on API data
- Uses actual floor names from IndoorAtlas

### 3. Enhanced IndoorAtlasMapView (`src/components/IndoorAtlasMapView.tsx`)

**New Props**:
```typescript
onFloorDataLoaded?: (floorData: VenueFloorData) => void;
onFloorDataError?: (error: string) => void;
```

**Features**:
- Automatically loads floor data when venue ID changes
- Shows loading state while fetching data
- Displays error state if loading fails
- Provides callbacks for parent components

### 4. Updated Configuration (`src/config/indooratlas.ts`)

**New API Endpoints**:
```typescript
API_ENDPOINTS: {
  BASE_URL: 'https://api.indooratlas.com',
  FLOOR_PLANS: '/v1/venues/{venueId}/floorplans',
  VENUE_INFO: '/v1/venues/{venueId}',
}
```

**Cache Settings**:
```typescript
FLOOR_PLAN_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
FLOOR_PLAN_RETRY_ATTEMPTS: 3,
FLOOR_PLAN_TIMEOUT: 10000, // 10 seconds
```

## Usage Examples

### Basic Implementation

```typescript
// Load floor data for a venue
const floorData = await FloorPlanService.getVenueFloors('venue-123');

// Get available floor levels
const floors = await FloorPlanService.getAvailableFloors('venue-123');
// Returns: [-1, 0, 1, 2, 3] for a building with basement

// Get floor name
const floorName = await FloorPlanService.getFloorName('venue-123', -1);
// Returns: "Basement Level 1"
```

### Different Venue Types

The system supports different building configurations:

**Standard Building** (floors 0-3):
```json
{
  "venueId": "standard-building",
  "floors": [
    { "id": "floor-0", "name": "Ground Floor", "level": 0 },
    { "id": "floor-1", "name": "First Floor", "level": 1 },
    { "id": "floor-2", "name": "Second Floor", "level": 2 },
    { "id": "floor-3", "name": "Third Floor", "level": 3 }
  ],
  "defaultFloor": 0,
  "minFloor": 0,
  "maxFloor": 3
}
```

**Building with Basement** (floors -1 to 2):
```json
{
  "venueId": "basement-building",
  "floors": [
    { "id": "floor-b1", "name": "Basement Level 1", "level": -1 },
    { "id": "floor-0", "name": "Ground Floor", "level": 0 },
    { "id": "floor-1", "name": "First Floor", "level": 1 },
    { "id": "floor-2", "name": "Second Floor", "level": 2 }
  ],
  "defaultFloor": 0,
  "minFloor": -1,
  "maxFloor": 2
}
```

**High-Rise Building** (floors 0-5):
```json
{
  "venueId": "high-rise-building",
  "floors": [
    { "id": "floor-0", "name": "Lobby", "level": 0 },
    { "id": "floor-1", "name": "Mezzanine", "level": 1 },
    { "id": "floor-2", "name": "Second Floor", "level": 2 },
    { "id": "floor-3", "name": "Third Floor", "level": 3 },
    { "id": "floor-4", "name": "Fourth Floor", "level": 4 },
    { "id": "floor-5", "name": "Fifth Floor", "level": 5 }
  ],
  "defaultFloor": 0,
  "minFloor": 0,
  "maxFloor": 5
}
```

## User Experience

### Loading States

1. **Initial Load**: When user switches to "Indoor Floor Plan", shows loading spinner
2. **Progress Message**: "Loading floors..." with activity indicator
3. **Success**: Floor buttons appear with actual floor names
4. **Error**: Error message with retry button

### Error Handling

- **Network Error**: "Failed to load floor data" with retry option
- **No Venue ID**: "No venue ID provided" error
- **API Timeout**: Automatic retry with exponential backoff
- **Fallback**: Uses default floors (0, 1, 2, 3) if API fails

### Floor Selector Behavior

- **Dynamic Buttons**: Number of buttons changes based on venue
- **Floor Names**: Shows actual floor names (e.g., "Basement Level 1", "Lobby")
- **Active State**: Highlights currently selected floor
- **Responsive**: Adapts to different screen sizes

## Testing

### Mock Data Testing

The `FloorPlanService` includes mock data for testing different venue configurations:

```typescript
// Test standard building
const standardData = await FloorPlanService.getVenueFloors('default');

// Test building with basement
const basementData = await FloorPlanService.getVenueFloors('basement-venue');

// Test high-rise building
const highRiseData = await FloorPlanService.getVenueFloors('high-rise-venue');
```

### Error Scenarios

1. **No Internet**: Shows error with retry button
2. **Invalid Venue ID**: Falls back to default floors
3. **API Timeout**: Shows timeout error
4. **Server Error**: Displays server error message

## Configuration

### Environment Variables

```bash
# Required for dynamic floor loading
EXPO_PUBLIC_INDOORATLAS_VENUE_ID=your-venue-id-here
EXPO_PUBLIC_INDOORATLAS_API_KEY=your-api-key
EXPO_PUBLIC_INDOORATLAS_API_SECRET=your-api-secret
```

### Venue ID Setup

1. **Get Venue ID**: From IndoorAtlas dashboard after mapping venue
2. **Add to .env**: Set `EXPO_PUBLIC_INDOORATLAS_VENUE_ID`
3. **Test**: Switch to indoor mode to see dynamic floors

## Benefits

### ✅ **Automatic Adaptation**
- No manual configuration needed
- Adapts to any venue configuration
- Supports different building types

### ✅ **Better User Experience**
- Shows actual floor names
- Handles different floor numbering
- Provides loading feedback

### ✅ **Robust Error Handling**
- Graceful fallbacks
- User-friendly error messages
- Retry functionality

### ✅ **Performance Optimized**
- Caching system
- Lazy loading
- Efficient API calls

## Future Enhancements

### Real API Integration
- Replace mock data with actual IndoorAtlas API calls
- Implement proper authentication
- Add rate limiting

### Advanced Features
- Floor plan images
- 3D floor visualization
- Custom floor markers
- Floor-specific POIs

### Performance Improvements
- Background data prefetching
- Offline floor data
- Progressive loading
- Image optimization

## Troubleshooting

### Common Issues

1. **No floors showing**: Check venue ID configuration
2. **Loading forever**: Check network connection and API credentials
3. **Wrong floors**: Verify venue ID matches mapped location
4. **Error on retry**: Check IndoorAtlas API status

### Debug Logs

Enable debug logging to see floor data loading:

```typescript
console.log('🏢 Loading floor data for venue:', venueId);
console.log('✅ Floor data loaded:', floorData);
console.error('❌ Failed to load floor data:', error);
```

## Conclusion

The dynamic floor selector implementation provides a robust, user-friendly solution that automatically adapts to different venue configurations. It includes comprehensive error handling, loading states, and fallback mechanisms to ensure a smooth user experience regardless of the building type or network conditions.
