# 📱 Building for Your iPhone - Step by Step

## The Problem
You were opening **Expo Go** (the pre-built app), but we need to build a **custom development build** because we added native IndoorAtlas modules.

## ✅ Solution: Build with Xcode Properly

### Step 1: Open Terminal and Run This Command

```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo run:ios --device
```

**Then select your iPhone from the list when prompted.**

### Step 2: Alternative - Use Xcode with Correct Settings

If the command line doesn't work, use Xcode:

1. **Open the workspace:**
   ```bash
   open /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo/ios/DeliveryTrackerExpo.xcworkspace
   ```

2. **In Xcode:**
   - **Top toolbar**: Click where it says "DeliveryTrackerExpo > [Device]"
   - **Select your iPhone** (should say "iPhone" or "iPhone 13 Pro Max")
   - **Important**: Make sure it's NOT "Any iOS Device" or a simulator

3. **Check the Scheme:**
   - Click on "DeliveryTrackerExpo" (next to the play button)
   - Make sure it says **"DeliveryTrackerExpo"** (not "Expo Go")

4. **Build and Run:**
   - Press the **Play button (▶️)** or press `Cmd + R`
   - This will take 2-5 minutes the first time

5. **Watch for Build Progress:**
   - You'll see "Building..." at the top
   - Wait for it to complete
   - It will automatically install on your iPhone

### Step 3: Trust the Developer Certificate

After the app installs, you might see "Untrusted Developer":

1. On your iPhone: **Settings** → **General** → **VPN & Device Management**
2. Tap your developer profile (your email)
3. Tap **Trust**
4. Open the app again

---

## 🎯 What You Should See

### During Build (in Xcode):
```
Building DeliveryTrackerExpo...
Compiling Swift files...
Linking...
Installing on iPhone...
```

### After Launch (in app):
- The actual DeliveryTrackerExpo app (NOT Expo Go)
- User Screen and Bartender Screen tabs
- No "Enter URL manually" prompt

### In Console (View → Debug Area → Activate Console):
```
✅ env: load .env
✅ 🏢 Initializing IndoorAtlas Service on ios...
✅ ✅ IndoorAtlas initialized successfully on ios
```

---

## ❌ Common Issues

### Issue: Still Opens Expo Go
**Solution**: Delete Expo Go from your iPhone first
- Long press Expo Go icon → Delete
- Then build again

### Issue: "No Scheme"
**Solution**: 
- Product → Scheme → Select "DeliveryTrackerExpo"

### Issue: Build Fails with Signing Error
**Solution**:
1. Select project in left sidebar
2. Select target "DeliveryTrackerExpo"
3. Signing & Capabilities tab
4. Check "Automatically manage signing"
5. Select your Apple ID team

---

## 🚀 Quick Start Command

Run this in Terminal (it will prompt you to select your device):

```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo && npx expo run:ios --device
```

When prompted, select: **iPhone (iPhone 13 Pro Max)**

---

## ✅ Success Checklist

After successful build:
- [ ] App icon appears on iPhone (not Expo Go icon)
- [ ] App opens without "Enter URL" screen
- [ ] Can see User/Bartender screens
- [ ] Location permission prompt appears
- [ ] Console shows IndoorAtlas initialized

---

**Need help?** Check `DEVICE_TROUBLESHOOTING.md` for detailed solutions.

