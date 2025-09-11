import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import UserScreen from './src/screens/UserScreen';
import BartenderScreen from './src/screens/BartenderScreen';
import { UserRole } from './src/types/order';

export default function App() {
  const [role, setRole] = useState<UserRole>('user');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>Delivery Tracker</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            onPress={() => setRole('user')}
            style={[styles.segmentBtn, role === 'user' ? styles.segmentActive : null]}
          >
            <Text style={[styles.segmentText, role === 'user' ? styles.segmentTextActive : null]}>User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRole('bar')}
            style={[styles.segmentBtn, role === 'bar' ? styles.segmentActive : null]}
          >
            <Text style={[styles.segmentText, role === 'bar' ? styles.segmentTextActive : null]}>Bar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {role === 'user' ? <UserScreen /> : <BartenderScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
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
  appTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7C7CC',
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#C7C7CC',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});
