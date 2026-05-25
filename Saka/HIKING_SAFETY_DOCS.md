# Hiking Safety Feature Documentation

## Overview

The Hiking Safety Feature provides real-time location tracking, emergency SOS capabilities, and offline-first architecture for hiking safety. It combines foreground and background tracking with local storage and automatic Supabase uploads.

## Features

### 🎯 Core Features

1. **Foreground Location Tracking**
   - High-accuracy GPS tracking during active use
   - Real-time location updates every 5 seconds or 10 meters
   - Immediate UI feedback with current coordinates

2. **Background Location Tracking**
   - Continuous tracking when app is backgrounded
   - Battery-efficient update intervals (30 seconds / 50 meters)
   - Requires background location permission

3. **Emergency SOS Button**
   - One-tap emergency alert system
   - Immediate high-accuracy GPS acquisition
   - Priority upload to backend
   - Suitable for search and rescue integration

4. **Offline Support**
   - All locations saved to AsyncStorage immediately
   - Automatic upload queue management
   - Graceful retry when reconnecting to network
   - Complete location history stored locally

5. **Permission Management**
   - Proper OS-level permission requests
   - Graceful degradation if permissions denied
   - Clear user feedback on permission status

## File Structure

```
src/
├── services/
│   └── locationService.js          # Core location tracking service
├── screens/
│   └── SafetyScreen.tsx            # UI components for safety features
├── config/
│   ├── api.ts                      # Existing API config
│   └── locationApi.ts              # Location-specific API utilities
└── lib/
    └── supabase.ts                 # Supabase client
```

## Installation

### 1. Install Dependencies

The required packages have been added to `package.json`:
- `expo-location: ~18.0.11` - Location tracking
- `expo-task-manager: ~12.0.7` - Background tasks

Install them:
```bash
npm install
# or
yarn install
```

### 2. Update app.json Permissions

Permissions have already been configured in `app.json`:

**iOS Permissions:**
```json
"ios": {
  "infoPlist": {
    "NSLocationWhenInUseUsageDescription": "...",
    "NSLocationAlwaysAndWhenInUseUsageDescription": "...",
    "UIBackgroundModes": ["location"]
  }
}
```

**Android Permissions:**
```json
"permissions": [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION"
]
```

### 3. Create Supabase Table (Optional)

The system stores locations locally by default. To enable Supabase uploads, create this table:

```sql
CREATE TABLE hiker_locations (
  id bigint primary key generated always as identity,
  latitude float8 not null,
  longitude float8 not null,
  accuracy float8 not null,
  altitude float8,
  heading float8,
  speed float8,
  timestamp timestamp not null,
  is_sos boolean default false,
  user_id uuid references auth.users,
  created_at timestamp default now()
);

-- Enable Row Level Security (if needed)
ALTER TABLE hiker_locations ENABLE ROW LEVEL SECURITY;
```

## Usage

### Import in Your App

```typescript
import SafetyScreen from '../src/screens/SafetyScreen';
import locationService from '../src/services/locationService';
```

### Add to Navigation

```typescript
// In your navigation stack
import SafetyScreen from '../src/screens/SafetyScreen';

// Add to your drawer, tab, or stack navigator
<Drawer.Screen name="safety" component={SafetyScreen} />
```

### Basic Usage Example

```typescript
import React from 'react';
import { View, Button, Alert } from 'react-native';
import locationService from '../src/services/locationService';

export default function MyScreen() {
  const startTracking = async () => {
    const success = await locationService.startForegroundTracking(
      (location) => {
        console.log('New location:', location);
      }
    );
    
    if (success) {
      Alert.alert('Success', 'Tracking started');
    }
  };

  const getSOS = async () => {
    const location = await locationService.getCurrentLocation();
    if (location) {
      console.log('Emergency location:', location);
      // Send to emergency services
    }
  };

  return (
    <View>
      <Button title="Start Tracking" onPress={startTracking} />
      <Button title="SOS" onPress={getSOS} color="red" />
    </View>
  );
}
```

## API Reference

### LocationService

#### Methods

**`requestForegroundPermission()`**
- Requests foreground location permission
- Returns: `Promise<boolean>`

**`requestBackgroundPermission()`**
- Requests background location permission
- Returns: `Promise<boolean>`

**`checkPermissions()`**
- Checks current permission status
- Returns: `Promise<{foreground: boolean, background: boolean}>`

**`startForegroundTracking(callback)`**
- Start foreground tracking with real-time updates
- Parameters: 
  - `callback: (location) => void` - Called with each location
- Returns: `Promise<boolean>`

**`stopForegroundTracking()`**
- Stop foreground tracking
- Returns: `Promise<void>`

**`startBackgroundTracking()`**
- Start background location updates
- Returns: `Promise<boolean>`

**`stopBackgroundTracking()`**
- Stop background tracking
- Returns: `Promise<void>`

**`getCurrentLocation()`**
- Get current location with high accuracy
- Returns: `Promise<LocationObject|null>`

**`getLastLocation()`**
- Get last known location from storage
- Returns: `Promise<LocationData|null>`

**`getLocationHistory()`**
- Get all tracked locations
- Returns: `Promise<LocationData[]>`

**`retryQueuedUploads()`**
- Manually retry any failed uploads
- Returns: `Promise<void>`

**`getTrackingStatus()`**
- Get current tracking state
- Returns: `{foregroundActive, backgroundActive, queuedUploads, isOnline}`

**`clearLocationData()`**
- Delete all location data from storage
- Returns: `Promise<void>`

### locationApi Module

**`uploadLocationToSupabase(location, isSOS)`**
- Upload location to Supabase
- Returns: `Promise<{success: boolean, error?: string}>`

**`getLocationHistory(limit)`**
- Get location history from backend
- Returns: `Promise<LocationData[]>`

**`calculateDistance(lat1, lon1, lat2, lon2)`**
- Calculate distance between coordinates
- Returns: `number` (kilometers)

**`formatLocation(location)`**
- Format location for display
- Returns: `string` (e.g., "40.71828, -74.00628")

**`getAccuracyLevel(accuracy)`**
- Get accuracy description
- Returns: `string` ("Excellent", "Good", "Fair", etc.)

**`generateMapsShareUrl(location)`**
- Create shareable Google Maps URL
- Returns: `string` (URL)

## Location Data Structure

```typescript
interface LocationData {
  latitude: number;        // Decimal degrees
  longitude: number;       // Decimal degrees
  accuracy: number;        // In meters
  altitude?: number;       // In meters above sea level
  heading?: number;        // Degrees from north (0-360)
  speed?: number;          // Meters per second
  timestamp: string;       // ISO 8601 timestamp
  is_sos?: boolean;        // True if emergency SOS
}
```

## Battery Optimization

The service is designed for battery efficiency:

### Foreground Mode
- 5-second update interval (user is actively using app)
- Highest accuracy for safety
- Battery drain: High (typical for active navigation)

### Background Mode
- 30-second update interval (app backgrounded)
- Balanced accuracy mode
- Battery drain: Moderate (optimized for continuous tracking)

### Tips for Better Battery Life

1. **Limit Foreground Tracking Duration**
   - Stop tracking when not hiking
   - Use SafetyScreen to manage tracking state

2. **Accept Balanced Accuracy**
   - Background mode uses Balanced accuracy (±100m typical)
   - Sufficient for rescue operations
   - Better battery efficiency than BestForNavigation

3. **Monitor Queued Uploads**
   - Check "queued uploads" status
   - WiFi is more battery-efficient than cellular for uploads
   - Manual retry button available for control

4. **Clear History Periodically**
   - Old location history uses AsyncStorage
   - Call `locationService.clearLocationData()` after hikes
   - Keeps app storage usage reasonable

## Offline Workflow

The safety feature handles offline scenarios gracefully:

1. **User goes offline**
   - Tracking continues with local AsyncStorage saves
   - Upload queue fills with pending locations
   - UI shows "OFFLINE" status badge

2. **Locations accumulate**
   - Service queues up to 100 locations locally
   - Each location stored with full metadata
   - No data loss if app crashes

3. **Network reconnects**
   - Service detects online status
   - Automatically uploads queued locations
   - Shows retry button if manual intervention needed

4. **Emergency while offline**
   - SOS button works without network
   - Location saved locally immediately
   - Uploaded to backend when connection restored

## Permissions Explained

### iOS Permissions

- **NSLocationWhenInUseUsageDescription**
  - Required for foreground tracking
  - Shows when app is in use

- **NSLocationAlwaysAndWhenInUseUsageDescription**
  - Required for background tracking
  - Shows continuous tracking warning

- **UIBackgroundModes: ["location"]**
  - Enables background location updates

### Android Permissions

- **ACCESS_FINE_LOCATION**
  - High-accuracy GPS (required)

- **ACCESS_COARSE_LOCATION**
  - Network-based location fallback

- **ACCESS_BACKGROUND_LOCATION**
  - Background tracking (separate permission on Android 10+)

## Error Handling

The service handles common error scenarios:

```typescript
// Permission denied
if (!hasPermission) {
  Alert.alert('Permission Required', 
    'Location access is required for hiking safety');
  return;
}

// GPS unavailable
const location = await locationService.getCurrentLocation();
if (!location) {
  Alert.alert('GPS Error', 'Could not get location. Try again.');
  return;
}

// Network error during upload
// Automatically queued for retry
// Shows notification with retry button
```

## Testing

### Test Checklist

- [ ] Request and grant foreground permission
- [ ] Start foreground tracking - see real-time updates
- [ ] Stop tracking - verify stops correctly
- [ ] Request background permission
- [ ] Start background tracking
- [ ] Move phone - verify periodic updates
- [ ] Go offline - verify no upload errors
- [ ] Go online - verify automatic upload
- [ ] Press SOS button - verify immediate location capture
- [ ] Test on both iOS and Android

### Simulating Locations (Testing)

```typescript
// Using Expo DevClient or emulator location simulation
// Android: Emulator menu > Extended controls > Location
// iOS: Xcode > Debug > Simulate Location

// Or use mock location service:
import locationService from '../src/services/locationService';

const mockLocation = {
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10,
  altitude: 0,
  heading: 0,
  speed: 0,
  timestamp: new Date().toISOString(),
};

await locationService._addToLocationHistory(mockLocation);
```

## Troubleshooting

### Tracking Not Starting

**Problem:** "Failed to start foreground tracking"

**Solutions:**
1. Check permission status in app settings
2. Verify location services enabled on device
3. Restart the app
4. Check device has active GPS

### Background Tracking Not Working

**Problem:** Location updates stop when app backgrounded

**Solutions:**
1. Verify background permission granted (separate prompt on Android)
2. Check app isn't restricted by battery optimization settings
3. Ensure iOS location permission set to "Always"
4. Verify `expo-task-manager` properly configured

### Locations Not Uploading

**Problem:** Queued uploads persist

**Solutions:**
1. Verify Supabase table exists and is properly configured
2. Check internet connectivity
3. Use "Retry Uploads" button
4. Verify Supabase credentials in environment variables

### High Battery Drain

**Problem:** Excessive battery consumption

**Solutions:**
1. Use background tracking instead of always-foreground
2. Stop tracking when not needed
3. Check device battery optimization isn't killing background tasks
4. Verify accuracy not set to BestForNavigation in background

## Security Considerations

### Data Privacy

- All locations stored locally in AsyncStorage
- No automatic transmission without backend configured
- User controls when data uploaded

### Authentication

- Integrate with Supabase auth to tie locations to user ID
- Set Row Level Security policies on Supabase
- Only authenticated users can upload/view

### Emergency Contacts

- Implement notification system for SOS alerts
- Consider encryption for sensitive data
- Test emergency workflows before deployment

## Production Deployment

### Pre-Launch Checklist

- [ ] Update privacy policy with location tracking disclosure
- [ ] Test on real devices (not just simulators)
- [ ] Configure Supabase production database
- [ ] Set up emergency contact notification system
- [ ] Test offline scenarios
- [ ] Verify battery drain acceptable
- [ ] Load test background location updates
- [ ] Get app store review (may ask about always-on location)

### App Store Considerations

- **iOS**: Always-on location requires strong justification
  - Safety/emergency use is good reason
  - May require review before approval

- **Android**: Background location permission
  - Added in Android 10
  - Users must grant separately
  - Clearly communicate need

## Advanced Integration

### Integrate with Emergency Services

```typescript
// Send SOS to emergency backend
const emergencyLocation = await locationService.getCurrentLocation();

await supabase
  .from('sos_alerts')
  .insert({
    location: emergencyLocation.coords,
    user_id: userId,
    timestamp: new Date().toISOString(),
  });

// Notify emergency contacts via push notification
// Send location to emergency services API
```

### Real-time Trail Map

```typescript
// Track entire hiking trail
import { locationApi } from '../src/config/locationApi';

const history = await locationService.getLocationHistory();
// Use with Mapbox/Google Maps to draw polyline
```

## Support

For issues or feature requests:
1. Check troubleshooting section above
2. Review Expo documentation: https://docs.expo.dev/
3. Check Supabase docs: https://supabase.com/docs

## License

This hiking safety feature is part of the Saka hiking app.
