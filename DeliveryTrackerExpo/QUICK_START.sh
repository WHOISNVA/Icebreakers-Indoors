#!/bin/bash

echo "🚀 DeliveryTrackerExpo - Quick Start"
echo "====================================="
echo ""

# Navigate to project
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if Pods are installed
if [ ! -d "ios/Pods" ]; then
    echo "📦 Installing iOS dependencies..."
    cd ios
    pod install
    cd ..
fi

echo ""
echo "✅ Everything is ready!"
echo ""
echo "Now running: npx expo run:ios --device"
echo ""
echo "This will:"
echo "  1. Start Metro bundler automatically"
echo "  2. Build the native iOS app"
echo "  3. Install it on your iPhone"
echo "  4. Launch the app"
echo ""
echo "When prompted, select your iPhone from the list."
echo ""

# Run the app
npx expo run:ios --device


