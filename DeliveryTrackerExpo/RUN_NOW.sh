#!/bin/bash

echo "🚀 Running DeliveryTrackerExpo - The Right Way"
echo "==============================================="
echo ""

# Navigate to project
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo

# Kill any existing Metro
echo "🧹 Cleaning up old processes..."
lsof -ti:8081 | xargs kill -9 2>/dev/null
sleep 2

echo ""
echo "✅ Ready!"
echo ""
echo "Now running: npx expo run:ios --device"
echo ""
echo "This will:"
echo "  ✅ Start Metro bundler automatically"
echo "  ✅ Build the iOS app properly"
echo "  ✅ Set up dev-client connection"
echo "  ✅ Install on your iPhone"
echo "  ✅ Launch without connection errors!"
echo ""
echo "When prompted, select your iPhone."
echo ""
echo "⏳ Starting in 3 seconds..."
sleep 3

# Run with expo CLI (the correct way!)
npx expo run:ios --device


