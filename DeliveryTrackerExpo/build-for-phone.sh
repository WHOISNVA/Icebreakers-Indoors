#!/bin/bash

echo "📱 Building DeliveryTrackerExpo for iPhone 13 Pro Max"
echo "======================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if device is connected
echo "🔍 Checking for connected devices..."
DEVICE_COUNT=$(xcrun devicectl list devices | grep "connected" | wc -l | xargs)

if [ "$DEVICE_COUNT" -eq "0" ]; then
    echo -e "${RED}❌ No devices connected!${NC}"
    echo "Please connect your iPhone via USB and trust this computer."
    exit 1
fi

echo -e "${GREEN}✅ Found $DEVICE_COUNT connected device(s)${NC}"
xcrun devicectl list devices | grep "connected"
echo ""

# Check if Metro is running
echo "🔍 Checking Metro bundler..."
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Metro is already running on port 8081${NC}"
    echo "This is good! Continuing..."
else
    echo -e "${YELLOW}⚠️  Metro is not running. Starting it now...${NC}"
    echo "Opening new terminal for Metro..."
    osascript -e 'tell app "Terminal" to do script "cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo && npx expo start --clear"'
    echo "Waiting 5 seconds for Metro to start..."
    sleep 5
fi
echo ""

# Check code signing
echo "🔍 Checking code signing..."
SIGNING_COUNT=$(security find-identity -v -p codesigning | grep "Apple Development" | wc -l | xargs)
if [ "$SIGNING_COUNT" -gt "0" ]; then
    echo -e "${GREEN}✅ Code signing identity found${NC}"
else
    echo -e "${RED}❌ No code signing identity found!${NC}"
    echo "Please add your Apple ID in Xcode → Settings → Accounts"
    exit 1
fi
echo ""

# Build for device
echo "🔨 Building for device..."
echo "This may take a few minutes..."
echo ""

cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo

# Try to build with device ID
npx expo run:ios --device 1E3B0761-9532-5556-B246-76CE80BFB5A3

BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo ""
    echo "📱 Next steps:"
    echo "1. If you see 'Untrusted Developer' on your iPhone:"
    echo "   Settings → General → VPN & Device Management → Trust"
    echo ""
    echo "2. Check the app is running and watch for console logs"
    echo ""
    echo "3. Test IndoorAtlas by:"
    echo "   - Creating an order in User Screen"
    echo "   - Going to Bartender Screen"
    echo "   - Clicking 'Navigate' button"
    echo "   - Clicking 'AR Mode' button"
else
    echo ""
    echo -e "${RED}❌ Build failed!${NC}"
    echo ""
    echo "Common fixes:"
    echo "1. Open Xcode and check Signing & Capabilities"
    echo "2. Make sure your iPhone is unlocked"
    echo "3. Trust this computer on your iPhone"
    echo "4. Try building directly from Xcode:"
    echo "   open ios/DeliveryTrackerExpo.xcworkspace"
fi
