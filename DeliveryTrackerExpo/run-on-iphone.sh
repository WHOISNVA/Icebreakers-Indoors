#!/bin/bash

cd "$(dirname "$0")"

echo "🔍 Finding your iPhone..."

# Get the first connected iPhone
DEVICE_UDID=$(xcrun xctrace list devices 2>&1 | grep "iPhone" | grep -v "Simulator" | head -1 | grep -o '([0-9A-F]\{8\}-[0-9A-F]\{16\})' | tr -d '()')

if [ -z "$DEVICE_UDID" ]; then
    echo "❌ No iPhone found. Please:"
    echo "   1. Connect your iPhone via USB"
    echo "   2. Unlock your iPhone"
    echo "   3. Trust this computer if prompted"
    exit 1
fi

echo "✅ Found iPhone: $DEVICE_UDID"
echo ""
echo "🚀 Building and installing app..."
echo ""

# Build and install to the specific device
npx expo run:ios --device "$DEVICE_UDID"

