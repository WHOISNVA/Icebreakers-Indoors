#!/bin/bash

echo "📱 Building for iPhone..."
echo ""
echo "Your connected device:"
echo "  Name: iPhone (iPhone 13 Pro Max)"
echo "  ID: 1E3B0761-9532-5556-B246-76CE80BFB5A3"
echo ""
echo "Starting build..."
echo ""

cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo

# Build for the connected device
npx expo run:ios --device 1E3B0761-9532-5556-B246-76CE80BFB5A3

