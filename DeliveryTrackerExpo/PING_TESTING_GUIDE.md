# 🔔 Ping Feature Testing Guide

## What Changed

I've upgraded the PingService with:
- ✅ **Audio notifications** (beep sound that plays 3 times)
- ✅ **Haptic feedback** (strong vibration pattern)
- ✅ **Works even in silent mode** on iOS
- ✅ **Console logging** for debugging

## How to Test

### Step 1: Place an Order (User Screen)
1. Open the **User Screen** tab
2. Add items (e.g., 2 beers, 1 water)
3. Tap **"Submit Order"**
4. Watch the console for: `🔔 UserScreen: Subscribing to pings for order: [ORDER_ID]`

### Step 2: Send Ping (Bartender Screen)
1. Switch to **Bartender Screen** tab
2. Find the order you just created
3. Tap **"🔔 Ping Customer"** button
4. Watch the console for: `🔔 BartenderScreen: Sending ping for order: [ORDER_ID]`

### Step 3: Receive Notification (User Screen)
1. Switch back to **User Screen** tab
2. You should immediately see/hear:
   - 🔊 **3 beep sounds** (plays even in silent mode)
   - 📳 **3 haptic vibrations** (strong pattern)
   - 📱 **Alert popup** saying "Order Ready!"
3. Check console for: `🔔 UserScreen: Ping received!`

## Debugging Checklist

If the ping doesn't work, check:

### 1. Console Logs
Look for these messages in order:

```
✅ UserScreen: Setting up PingService for user-123
✅ UserScreen: Subscribing to pings for order: [ORDER_ID]
✅ BartenderScreen: Sending ping for order: [ORDER_ID]
✅ BartenderScreen: Ping send result: true
✅ UserScreen: Ping received!
✅ Ping notification triggered: [PING_DATA]
```

### 2. Firebase Connection
- Make sure Firebase is configured in `src/config/firebase.ts`
- Check that database rules allow read/write to `/pings/{orderId}`

### 3. User ID Match
- **User Screen** uses: `user-123`
- **Bartender Screen** sends to: `user-123`
- These MUST match for the ping to be received

### 4. Order ID
- The ping uses the `lastOrderId` from when you placed the order
- If you placed multiple orders, only the LAST order will receive pings
- Each new order overwrites the subscription

### 5. Audio Permissions
- iOS may ask for audio permission the first time
- Grant the permission when prompted
- The sound will play even if the phone is on silent mode

## Console Commands to Check

Open the browser console (or Metro bundler logs) and look for:

```bash
# When app loads
🔔 UserScreen: Setting up PingService for user-123

# After placing order
🔔 UserScreen: Subscribing to pings for order: abc123

# When bartender sends ping
🔔 BartenderScreen: Sending ping for order: abc123
🔔 BartenderScreen: Ping send result: true

# When user receives ping
🔔 UserScreen: Ping received! {orderId: "abc123", fromUserId: "bartender-123", ...}
🔔 Ping notification triggered: {orderId: "abc123", ...}
```

## What You Should Experience

### On User's Phone:
1. **Sound**: 3 beeps (even in silent mode)
2. **Haptics**: 3 strong vibrations
3. **Alert**: Popup saying "🔔 Order Ready! Your order is ready! Come pick it up at the bar."

### On Bartender's Screen:
1. Alert saying "Ping Sent - The customer has been notified"

## Common Issues & Solutions

### Issue: No sound, but alert shows
**Solution**: The audio might have failed to load. Check console for audio errors. The haptics should still work.

### Issue: No alert at all
**Solution**: 
- Check if you're on the User Screen tab (pings only show there)
- Verify the order ID matches
- Check Firebase connection
- Look for errors in console

### Issue: "Ping Sent" but no notification on user screen
**Solution**:
- The user ID might not match
- Check console logs on both screens
- Verify Firebase database rules allow writes to `/pings/`
- Make sure user is subscribed (placed an order)

### Issue: Alert shows but notification comes late
**Solution**: This is normal! Firebase real-time updates can take 1-3 seconds depending on network.

## Technical Details

### Sound Implementation
- Uses `expo-av` to play a base64-encoded WAV beep
- Plays 3 times with 300ms delay between each
- Volume set to 100%
- Configured to play in silent mode (`playsInSilentModeIOS: true`)

### Haptics Implementation
- Uses `expo-haptics` with `NotificationFeedbackType.Success`
- Triggers 3 times with 200ms delay
- Works on all iOS devices with Taptic Engine

### Firebase Structure
```json
{
  "pings": {
    "[orderId]": {
      "orderId": "abc123",
      "fromUserId": "bartender-123",
      "toUserId": "user-123",
      "timestamp": 1696176000000,
      "message": "Your order is ready!",
      "isActive": true
    }
  }
}
```

The ping automatically removes itself after 30 seconds.

## Next Steps

If it's still not working after checking all the above:
1. Share the console logs
2. Check if Firebase Realtime Database is enabled
3. Verify network connectivity on the device
4. Try restarting the app

---

**New packages installed:**
- `expo-av` - For audio playback
- `expo-haptics` - For vibration/haptic feedback
- `expo-battery` - For battery monitoring (LiveLocationService)



