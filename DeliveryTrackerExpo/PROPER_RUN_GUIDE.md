# 📱 How to Properly Run the App on iPhone

## ⚠️ THE ISSUE
When you run from Xcode, you see "Enter URL manually" - this is because Metro bundler isn't running!

## ✅ THE SOLUTION: Two-Step Process

### Step 1: Start Metro Bundler (Terminal)

**Open Terminal and run:**
```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo start --clear
```

**Keep this terminal open!** You should see:
```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press j │ open debugger
› Press r │ reload app
› Press m │ toggle menu
› Press o │ open project code in your editor

› Press ? │ show all commands
```

**LEAVE THIS RUNNING** - Don't close this terminal!

---

### Step 2: Build and Run from Xcode

**In a NEW terminal window:**
```bash
open /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo/ios/DeliveryTrackerExpo.xcworkspace
```

**In Xcode:**
1. Select your iPhone from the device dropdown (top toolbar)
2. Click the **Play button (▶️)** or press `Cmd + R`

**What happens:**
- Xcode builds the native iOS app
- Installs it on your iPhone via USB
- App launches on your iPhone
- App connects to Metro bundler (through USB tunneling)
- JavaScript loads and your app appears!

---

## 🎉 Success Indicators

### ✅ In Terminal (Metro):
```
› Metro waiting on exp://192.168.x.x:8081
iOS Bundling complete 1234ms
```

### ✅ In Xcode Console (View → Debug Area → Activate Console):
```
env: load .env
🏢 Initializing IndoorAtlas Service on ios...
✅ IndoorAtlas initialized successfully on ios
```

### ✅ On iPhone:
- App opens directly (no "Enter URL" screen)
- You see the "Delivery Tracker" UI with User/Bar tabs
- Location permission prompt appears
- App works normally!

---

## 🔧 Alternative: Use Expo CLI for Everything

You can also let Expo handle everything:

```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo run:ios --device
```

**When prompted:**
- Select your iPhone from the list
- Expo will start Metro AND build the app
- Everything happens automatically!

---

## ❓ Why This Happens

**Expo apps with native modules require two things:**

1. **Metro Bundler** - Serves the JavaScript code
2. **Native App** - The iOS binary that runs on your phone

When you build from Xcode alone:
- ✅ Native app is built and installed
- ❌ Metro isn't running
- 💀 App can't load JavaScript
- 📱 Shows "Connect to Metro" screen (what you're seeing)

---

## 🚀 Quick Start Script

I've created a helper script for you:

```bash
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
./start-metro.sh
```

Then in Xcode, just press Play!

---

## 🆘 Troubleshooting

### Issue: "Could not connect to development server"
**Solution**: Make sure Metro is running (Step 1)
```bash
# Check if Metro is running
lsof -i:8081
# Should show: node ... *:8081 (LISTEN)
```

### Issue: App shows connection screen
**Solution**: Metro isn't running or port is blocked
- Stop Metro (Ctrl+C in terminal)
- Restart: `npx expo start --clear`
- Rebuild from Xcode

### Issue: Build fails in Xcode
**Solution**: Clean and rebuild
1. Product → Clean Build Folder (`Cmd + Shift + K`)
2. Product → Build (`Cmd + B`)
3. Product → Run (`Cmd + R`)

### Issue: "No bundle URL present"
**Solution**: The app can't find Metro
1. Check Metro is running (port 8081)
2. Check your iPhone and Mac are on the same WiFi (or use USB)
3. Restart both Metro and Xcode build

---

## 📝 Complete Workflow

### First Time Setup:
1. `cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo`
2. `npm install`
3. `cd ios && pod install && cd ..`

### Every Time You Want to Run:

**Option A: Two-Terminal Method**
```bash
# Terminal 1:
npx expo start --clear
# Keep running!

# Terminal 2 (or Xcode):
open ios/DeliveryTrackerExpo.xcworkspace
# Then press Play in Xcode
```

**Option B: One-Command Method**
```bash
npx expo run:ios --device
# Select your iPhone when prompted
```

---

## ✨ Pro Tips

1. **Always start Metro first** before running from Xcode
2. **Keep Metro running** while developing
3. **Use `r` in Metro terminal** to reload the app (faster than rebuilding)
4. **Use Xcode console** to see native logs and IndoorAtlas status
5. **Press `j` in Metro** to open React Native debugger

---

## 🎯 TL;DR

```bash
# Terminal 1 - START THIS FIRST AND KEEP IT OPEN:
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo start --clear

# Then open Xcode and press Play
open /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo/ios/DeliveryTrackerExpo.xcworkspace
```

**That's it! Metro provides the JavaScript, Xcode builds and installs the native app.** 🚀


