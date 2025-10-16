#!/bin/bash

echo "🧹 Cleaning build artifacts..."
rm -rf ~/Library/Developer/Xcode/DerivedData/DeliveryTrackerExpo-*
rm -rf ios/build

echo "📱 Finding iPhone..."
DEVICE_UDID=$(xcrun xctrace list devices 2>&1 | grep "iPhone" | grep -v "Simulator" | head -1 | grep -o '([0-9A-F]\{8\}-[0-9A-F]\{16\})' | tr -d '()')

if [ -z "$DEVICE_UDID" ]; then
  echo "❌ No iPhone found. Please connect your iPhone via USB."
  exit 1
fi

echo "✅ Found iPhone: $DEVICE_UDID"
echo "🔨 Building and installing app..."

npx expo run:ios --device "$DEVICE_UDID"

