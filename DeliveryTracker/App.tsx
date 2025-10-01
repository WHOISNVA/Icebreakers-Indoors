/**
 * Delivery Tracker App
 * A React Native app for tracking delivery location using react-native-geolocation-service
 *
 * @format
 */

import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import DeliveryTracker from './src/components/DeliveryTracker';
import BartenderScreen from './src/components/BartenderScreen';

function App(): React.JSX.Element {
  const [currentScreen, setCurrentScreen] = useState<'customer' | 'bartender'>('customer');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Navigation Header */}
      <View style={styles.navigationHeader}>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'customer' && styles.activeNavButton]}
          onPress={() => setCurrentScreen('customer')}
        >
          <Text style={[styles.navButtonText, currentScreen === 'customer' && styles.activeNavButtonText]}>
            Customer View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'bartender' && styles.activeNavButton]}
          onPress={() => setCurrentScreen('bartender')}
        >
          <Text style={[styles.navButtonText, currentScreen === 'bartender' && styles.activeNavButtonText]}>
            Bartender View
          </Text>
        </TouchableOpacity>
      </View>

      {/* Screen Content */}
      {currentScreen === 'customer' ? <DeliveryTracker /> : <BartenderScreen />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  navigationHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  activeNavButton: {
    backgroundColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeNavButtonText: {
    color: '#FFFFFF',
  },
});

export default App;
