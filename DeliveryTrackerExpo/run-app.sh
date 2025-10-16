#!/bin/bash

echo "🚀 Running DeliveryTrackerExpo on iPhone"
echo "=========================================="
echo ""

# Navigate to project directory
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo

# Check if Metro is already running
if lsof -i:8081 > /dev/null 2>&1; then
    echo "✅ Metro is already running on port 8081"
else
    echo "⚠️  Metro is not running!"
    echo ""
    echo "Please start Metro first by running:"
    echo "  ./start-metro.sh"
    echo ""
    echo "Or in a separate terminal:"
    echo "  npx expo start --clear"
    echo ""
    exit 1
fi

echo ""
echo "📱 Opening Xcode workspace..."
open /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo/ios/DeliveryTrackerExpo.xcworkspace

echo ""
echo "✅ Xcode opened!"
echo ""
echo "Now in Xcode:"
echo "  1. Select your iPhone from the device dropdown"
echo "  2. Press the Play button (▶️) or Cmd+R"
echo ""
echo "The app will build and run on your iPhone! 🎉"
echo ""


