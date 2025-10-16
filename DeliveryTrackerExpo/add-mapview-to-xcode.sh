#!/bin/bash

# Script to add RNIndoorAtlasMapView files to Xcode project

PROJECT_DIR="/Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo/ios"
PROJECT_FILE="$PROJECT_DIR/DeliveryTrackerExpo.xcodeproj/project.pbxproj"

echo "📦 Adding RNIndoorAtlasMapView files to Xcode project..."

# Check if files exist
if [ ! -f "$PROJECT_DIR/DeliveryTrackerExpo/RNIndoorAtlasMapView.swift" ]; then
    echo "❌ RNIndoorAtlasMapView.swift not found"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/DeliveryTrackerExpo/RNIndoorAtlasMapView.m" ]; then
    echo "❌ RNIndoorAtlasMapView.m not found"
    exit 1
fi

echo "✅ Files found, opening Xcode..."
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "1. Xcode will open shortly"
echo "2. Right-click on 'DeliveryTrackerExpo' folder in Project Navigator"
echo "3. Select 'Add Files to \"DeliveryTrackerExpo\"...'"
echo "4. Navigate to ios/DeliveryTrackerExpo/"
echo "5. Select both RNIndoorAtlasMapView.swift and RNIndoorAtlasMapView.m"
echo "6. Make sure 'Copy items if needed' is UNCHECKED"
echo "7. Make sure 'Create groups' is selected"
echo "8. Make sure 'DeliveryTrackerExpo' target is checked"
echo "9. Click 'Add'"
echo ""
echo "Press Enter when done..."

# Open Xcode
open "$PROJECT_DIR/DeliveryTrackerExpo.xcworkspace"

# Wait for user confirmation
read -p ""

echo "✅ Done! You can now build the app."

