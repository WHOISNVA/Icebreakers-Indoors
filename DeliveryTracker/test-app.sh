#!/bin/bash

echo "🚀 Delivery Tracker App - Testing Guide"
echo "========================================"

echo ""
echo "1. Starting Metro Bundler..."
npm start &
METRO_PID=$!

echo "2. Waiting for Metro to start..."
sleep 5

echo ""
echo "3. Choose your testing platform:"
echo "   a) Android Emulator/Device"
echo "   b) iOS Simulator/Device"
echo "   c) Both"
echo ""

read -p "Enter your choice (a/b/c): " choice

case $choice in
    a)
        echo "📱 Running on Android..."
        npx react-native run-android
        ;;
    b)
        echo "🍎 Running on iOS..."
        npx react-native run-ios
        ;;
    c)
        echo "📱🍎 Running on both platforms..."
        npx react-native run-android &
        npx react-native run-ios &
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        ;;
esac

echo ""
echo "✅ Testing commands completed!"
echo ""
echo "📋 Testing Checklist:"
echo "   ✓ App launches successfully"
echo "   ✓ Location permissions are requested"
echo "   ✓ Map displays correctly"
echo "   ✓ 'Get Location' button works"
echo "   ✓ 'Start Delivery' begins tracking"
echo "   ✓ Location updates in real-time"
echo "   ✓ 'Complete Delivery' stops tracking"
echo ""
echo "🔧 Troubleshooting:"
echo "   - Make sure location services are enabled"
echo "   - Grant all location permissions"
echo "   - Test on a real device for best results"
echo "   - Check console logs for any errors"

