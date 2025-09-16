# Firebase Setup Instructions

## 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: "delivery-tracker" (or any name)
4. Enable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Realtime Database
1. In your Firebase project, click "Realtime Database" in the left sidebar
2. Click "Create Database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to you)
5. Click "Done"

## 3. Get Configuration
1. Click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click "Web app" icon (</>) to add a web app
5. Enter app nickname: "Delivery Tracker"
6. Click "Register app"
7. Copy the config object (it looks like the one in firebase.ts)

## 4. Update Configuration
1. Open `src/config/firebase.ts`
2. Replace the placeholder values with your actual Firebase config
3. Save the file

## 5. Set Database Rules (Optional)
In Firebase Console > Realtime Database > Rules, you can set:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
This allows anyone to read/write (good for testing, not production).

## 6. Test
- Start the app: `npx expo start --lan`
- Place an order on one device
- Switch to Bar on another device
- You should see the order appear in real-time!
