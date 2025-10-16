#!/bin/bash

echo "🔍 IndoorAtlas Configuration Test"
echo "=================================="
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "✅ .env file exists"
    
    # Check for API key
    if grep -q "EXPO_PUBLIC_INDOORATLAS_API_KEY=7a08a66a" .env; then
        echo "✅ API Key configured"
    else
        echo "❌ API Key not found or incorrect"
    fi
    
    # Check for API secret
    if grep -q "EXPO_PUBLIC_INDOORATLAS_API_SECRET=" .env; then
        echo "✅ API Secret configured"
    else
        echo "❌ API Secret not found"
    fi
    
    # Check if enabled
    if grep -q "EXPO_PUBLIC_INDOORATLAS_ENABLED=true" .env; then
        echo "✅ IndoorAtlas enabled"
    else
        echo "⚠️  IndoorAtlas disabled in .env"
    fi
else
    echo "❌ .env file not found"
    echo "   Copy .env.example to .env and add your credentials"
fi

echo ""
echo "📱 Native Module Files"
echo "======================"

# Check iOS native module
if [ -f "ios/DeliveryTrackerExpo/RNIndoorAtlasModule.swift" ]; then
    echo "✅ iOS native module exists"
else
    echo "❌ iOS native module missing"
fi

# Check Android configuration
if [ -f "android/app/build.gradle" ]; then
    if grep -q "react-native-indoor-atlas" android/app/build.gradle; then
        echo "✅ Android module configured"
    else
        echo "⚠️  Android module not in build.gradle"
    fi
fi

echo ""
echo "🔧 Service Files"
echo "================"

# Check service files
FILES=(
    "src/services/IndoorAtlasService.ts"
    "src/services/IndoorAtlasNativeModule.ts"
    "src/config/indooratlas.ts"
    "src/components/ARNavigationView.tsx"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file missing"
    fi
done

echo ""
echo "🎯 Integration Status"
echo "===================="

# Check if ARNavigationView uses IndoorAtlas
if grep -q "IndoorAtlasService.watchPosition" src/components/ARNavigationView.tsx; then
    echo "✅ AR Navigation using IndoorAtlas"
else
    echo "❌ AR Navigation not using IndoorAtlas"
fi

# Check if BartenderScreen has navigation buttons
if grep -q "📹 AR Mode" src/screens/BartenderScreen.tsx; then
    echo "✅ AR Mode button present"
else
    echo "❌ AR Mode button missing"
fi

echo ""
echo "📋 Next Steps"
echo "============="
echo "1. Restart Metro: npx expo start --clear"
echo "2. Rebuild iOS: cd ios && pod install && cd .. && npx expo run:ios"
echo "3. Rebuild Android: npx expo run:android"
echo "4. Test navigation in the Bartender Screen"
echo ""
echo "✨ Configuration check complete!"

