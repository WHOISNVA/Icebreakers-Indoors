# 📱 Running on Physical iPhone - Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: "Could not launch" or "Failed to install"

**Possible Causes:**
- Code signing issue
- Bundle identifier conflict
- Device not trusted

**Solutions:**

#### A. Check Code Signing in Xcode
1. Open `DeliveryTrackerExpo.xcworkspace` in Xcode
2. Select the project in left sidebar
3. Select target "DeliveryTrackerExpo"
4. Go to "Signing & Capabilities" tab
5. Check these settings:
   - ✅ "Automatically manage signing" should be checked
   - ✅ Your Apple ID team should be selected
   - ✅ Bundle Identifier: `com.anonymous.DeliveryTrackerExpo`
   - ✅ Signing Certificate should show your name

#### B. Trust Your Developer Certificate on iPhone
1. After first install attempt, go to iPhone Settings
2. **Settings** → **General** → **VPN & Device Management**
3. Under "Developer App", tap your Apple ID
4. Tap **Trust "[Your Name]"**
5. Tap **Trust** in the popup

---

### Issue 2: "No code signing identities found"

**Solution:**
1. Open Xcode → **Settings** (Cmd + ,)
2. Go to **Accounts** tab
3. Click **+** to add your Apple ID if not present
4. Select your account → Click **Manage Certificates**
5. Click **+** → Select **Apple Development**
6. Close and try building again

---

### Issue 3: Metro Bundler Connection Issues

**Symptoms:**
- App opens but shows red screen
- "Unable to connect to Metro"
- Blank white screen

**Solution:**

#### A. Ensure Metro is Running
```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo start --clear
```

#### B. Check Network Connection
- iPhone and Mac must be on the **same WiFi network**
- Disable VPN on both devices
- Check firewall settings (System Settings → Network → Firewall)

#### C. Manual Metro Connection
If automatic connection fails:
1. Shake your iPhone (or use Hardware → Shake Gesture in simulator)
2. Tap "Configure Bundler"
3. Enter your Mac's IP address and port `192.168.x.x:8081`

To find your Mac's IP:
```bash
ipconfig getifaddr en0
```

---

### Issue 4: "Untrusted Developer" Message

**Solution:**
1. **Settings** → **General** → **VPN & Device Management**
2. Tap your developer profile
3. Tap **Trust**

---

### Issue 5: Build Succeeds but App Crashes on Launch

**Check Console Logs in Xcode:**
1. Build and run from Xcode (not command line)
2. Open **Console** (View → Debug Area → Activate Console)
3. Look for error messages

**Common Crash Causes:**

#### A. Missing Permissions
Check Info.plist has these keys (already added):
- ✅ NSLocationWhenInUseUsageDescription
- ✅ NSCameraUsageDescription
- ✅ NSMotionUsageDescription

#### B. IndoorAtlas SDK Issue
Look for these in console:
```
✅ Good: "IndoorAtlas initialized successfully"
❌ Bad: "IndoorAtlas initialization failed"
```

If initialization fails:
- Check API credentials in .env
- Verify IndoorAtlas pod is installed: `cd ios && pod install`

---

### Issue 6: "Provisioning Profile Doesn't Include Signing Certificate"

**Solution:**
1. In Xcode, select target → Signing & Capabilities
2. Change Team to "None"
3. Wait a moment
4. Change Team back to your Apple ID
5. Clean Build Folder (Product → Clean Build Folder)
6. Build again

---

### Issue 7: Device Not Showing in Xcode

**Solution:**

#### A. Check USB Connection
- Use original Apple cable
- Try different USB port
- Restart iPhone

#### B. Trust This Computer
On iPhone:
- When connected, you should see "Trust This Computer?" popup
- Tap **Trust**
- Enter your iPhone passcode

#### C. Check Device in Finder
- Open Finder
- Look for your iPhone in sidebar
- Click on it and ensure it's trusted

---

### Issue 8: "Unable to Install" - Storage Issues

**Solution:**
- Free up space on iPhone (need at least 1GB free)
- Delete old development builds
- Settings → General → iPhone Storage → Delete unused apps

---

## 🔧 Step-by-Step: Clean Build Process

If nothing works, try this clean build:

```bash
# 1. Stop all Metro processes
lsof -ti:8081 | xargs kill -9
lsof -ti:8082 | xargs kill -9

# 2. Clean iOS build
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo/ios
rm -rf build
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 3. Reinstall pods
pod deintegrate
pod install

# 4. Go back to project root
cd ..

# 5. Clear Metro cache
npx expo start --clear

# 6. In another terminal, build for device
npx expo run:ios --device
```

---

## 🎯 Recommended Workflow

### Using Xcode (Best for debugging):

1. **Start Metro** in Terminal:
   ```bash
   cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
   npx expo start --clear
   ```

2. **Open Xcode**:
   ```bash
   open ios/DeliveryTrackerExpo.xcworkspace
   ```

3. **Select your iPhone** from device dropdown (top toolbar)

4. **Build and Run** (Cmd + R)

5. **Watch Console** for logs (View → Debug Area → Activate Console)

---

## 📊 Verify Everything is Working

After successful launch, check:

### 1. Console Logs (in Xcode)
```
✅ env: load .env
✅ env: export EXPO_PUBLIC_INDOORATLAS_API_KEY...
✅ 🏢 Initializing IndoorAtlas Service on ios...
✅ ✅ IndoorAtlas initialized successfully on ios
```

### 2. App Functionality
- [ ] App opens without crashing
- [ ] Can see User Screen and Bartender Screen
- [ ] Location permission prompt appears
- [ ] Camera permission prompt appears (when using AR)
- [ ] Can create orders
- [ ] Can navigate to orders
- [ ] AR mode opens camera view

---

## 🆘 Still Having Issues?

Please provide:
1. **Exact error message** (screenshot or text)
2. **Where it fails** (build time, install time, or runtime)
3. **Console output** from Xcode
4. **Xcode version**: Run `xcodebuild -version`
5. **iOS version** on your iPhone

---

## 🔍 Quick Diagnostic Commands

Run these to check your setup:

```bash
# Check Xcode version
xcodebuild -version

# Check connected devices
xcrun devicectl list devices

# Check if Metro is running
lsof -i:8081

# Check code signing
security find-identity -v -p codesigning

# Check pods
cd ios && pod --version && cd ..
```

---

## ✅ Expected Setup

Your current configuration:
- Device: iPhone 13 Pro Max (connected)
- Bundle ID: com.anonymous.DeliveryTrackerExpo
- IndoorAtlas: Configured with API keys
- Permissions: Location, Camera, Motion (all configured)
- Pods: Installed (92 dependencies)

Everything should work! 🎉
