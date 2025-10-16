#!/bin/bash

echo "🚀 Starting Metro Bundler for DeliveryTrackerExpo"
echo "=================================================="
echo ""

# Kill any existing Metro processes
echo "🧹 Cleaning up old processes..."
lsof -ti:8081 | xargs kill -9 2>/dev/null
lsof -ti:8082 | xargs kill -9 2>/dev/null
killall node 2>/dev/null

sleep 2

echo "✅ Ready to start Metro"
echo ""

# Start Metro
cd /Users/whoisnva/Desktop/IcebreakersIndoors/DeliveryTrackerExpo
npx expo start --clear

# This will keep running and show you the QR code and connection info


