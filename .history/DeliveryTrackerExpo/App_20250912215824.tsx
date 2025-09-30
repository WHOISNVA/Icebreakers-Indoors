import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import UserScreen from './src/screens/UserScreen';
import BartenderScreen from './src/screens/BartenderScreen';
import { UserRole } from './src/types/order';

export default function App() {
  const [role, setRole] = useState<UserRole>('user');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.header}>
        <Text style={styles.appTitle}>🍺 BarConnect</Text>
        <Text style={styles.subtitle}>Smart Order & Location Tracking</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            onPress={() => setRole('user')}
            style={[styles.segmentBtn, role === 'user' ? styles.segmentActive : null]}
          >
            <Text style={[styles.segmentText, role === 'user' ? styles.segmentTextActive : null]}>
              Customer
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRole('bar')}
            style={[styles.segmentBtn, role === 'bar' ? styles.segmentActive : null]}
          >
            <Text style={[styles.segmentText, role === 'bar' ? styles.segmentTextActive : null]}>
              Bartender
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {role === 'user' ? <UserScreen /> : <BartenderScreen />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  segmentTextActive: {
    color: '#1a1a2e',
  },
  content: {
    flex: 1,
  },
  rolePicker: {
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  roleButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  userButton: {
    backgroundColor: '#007AFF',
  },
  barButton: {
    backgroundColor: '#5856D6',
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
