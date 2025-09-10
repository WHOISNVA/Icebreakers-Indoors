/**
 * Delivery Tracker App
 * A React Native app for tracking delivery location using react-native-geolocation-service
 *
 * @format
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DeliveryTracker from './src/components/DeliveryTracker';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <DeliveryTracker />
    </SafeAreaProvider>
  );
}

export default App;
