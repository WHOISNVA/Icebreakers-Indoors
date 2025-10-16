# 📱 Connecting iPhone to Metro - Complete Guide

## Why Simulator Works but iPhone Doesn't?

- **Simulator**: Connects via `localhost:8081` (always works, no network needed)
- **iPhone**: Needs to connect over WiFi to your Mac's IP address

---

## ✅ Method 1: Automatic Discovery (Easiest)

### Step 1: Restart Metro with LAN mode
Stop any running Metro, then in Terminal:

```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo start --clear --lan
```

### Step 2: On Your iPhone
1. **Close the app** completely (swipe up, remove from recent apps)
2. **Wait 10 seconds** for Metro to fully start
3. **Open the app again**
4. It should auto-discover and connect!

---

## ✅ Method 2: Manual URL Entry

If auto-discovery doesn't work:

### Step 1: Get Your Metro URL
In the Terminal where Metro is running, look for:
```
› Metro waiting on exp://192.168.x.x:8081
```

### Step 2: On Your iPhone
1. Open the app
2. Tap "Enter URL manually"
3. Type the **exact URL** from Metro (including `exp://`)
   - Example: `exp://192.168.1.231:8081`
4. Tap Connect

---

## ✅ Method 3: Rebuild with URL Embedded

This embeds the Metro connection in the build:

### Step 1: Set React Native Packager Hostname
```bash
export REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.231
```

### Step 2: Rebuild the app
```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo run:ios --device
```

Select your iPhone when prompted.

---

## ✅ Method 4: Use Tunnel Mode (Works on Any Network)

If you're having WiFi issues:

```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo start --clear --tunnel
```

This creates a public URL that works from anywhere, but it's slower.

---

## 🔧 Troubleshooting

### Issue: "No development servers found"

**Check 1: Same WiFi Network?**
- Mac WiFi: System Settings → Network → WiFi
- iPhone WiFi: Settings → WiFi
- **Must be on the SAME network!**

**Check 2: Firewall Blocking?**
```bash
# Temporarily disable firewall to test
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off

# Re-enable after testing
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

**Check 3: Is Metro Actually Running?**
```bash
lsof -i:8081
# Should show node process
```

**Check 4: Can iPhone Reach Your Mac?**
On your Mac, find your IP:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

On your iPhone, open Safari and go to: `http://192.168.1.231:8081`
- If it loads, Metro is reachable!
- If timeout, there's a network issue

---

### Issue: App Connects but Crashes

**Check Console in Xcode:**
1. Connect iPhone to Mac
2. Open Xcode → Window → Devices and Simulators
3. Select your iPhone
4. Click "Open Console"
5. Look for error messages

Common errors:
- `IndoorAtlasModule not found` → Rebuild the app
- `Location permission denied` → Grant location permission
- `Camera permission denied` → Grant camera permission

---

### Issue: Metro Shows Different IP

If Metro shows `exp://10.x.x.x` but your Mac is on `192.168.x.x`:

```bash
# Force Metro to use specific interface
export REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.231
npx expo start --clear --lan
```

---

## 📋 Complete Reset Procedure

If nothing works, do a complete reset:

```bash
# 1. Stop everything
killall node
killall Simulator
lsof -ti:8081 | xargs kill -9

# 2. Clean Metro cache
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
rm -rf node_modules/.cache
rm -rf .expo

# 3. Clean iOS build
cd ios
rm -rf build
rm -rf ~/Library/Developer/Xcode/DerivedData/*
pod deintegrate
pod install
cd ..

# 4. Rebuild
npx expo run:ios --device

# 5. Start Metro in another terminal
npx expo start --clear --lan
```

---

## 🎯 Quick Checklist

Before trying to connect:

- [ ] Metro is running (`npx expo start --lan`)
- [ ] iPhone and Mac on same WiFi
- [ ] iPhone shows "Development Build" at top
- [ ] Firewall not blocking port 8081
- [ ] Can ping Mac from iPhone (Safari test)
- [ ] App is freshly built (not Expo Go)

---

## 💡 Best Practice Setup

### Terminal 1: Metro Bundler
```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo start --clear --lan
```

Leave this running, it will show:
- QR code
- Connection URL
- Build progress
- Logs

### On iPhone:
1. Open app
2. Should auto-connect within 5 seconds
3. If not, shake phone → "Reload"

---

## 🆘 Still Not Working?

Your current setup:
- Mac IP: `192.168.1.231`
- iPhone: iPhone 13 Pro Max
- Device ID: `1E3B0761-9532-5556-B246-76CE80BFB5A3`

Try this emergency connection:

1. **On Mac:**
   ```bash
   cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
   export REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.231
   npx expo start --clear --lan --port 8081
   ```

2. **On iPhone:**
   - Open app
   - Tap "Enter URL manually"
   - Type: `exp://192.168.1.231:8081`
   - Tap Connect

3. **If still fails:**
   Share the error message from:
   - Terminal Metro output
   - iPhone screen (screenshot)
   - Xcode console logs

---

**Current Status:** Metro is running. Try opening the app now!

