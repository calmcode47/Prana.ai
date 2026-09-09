/* eslint-env jest */
import React from 'react';

// Mock vector icons
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name, ...props }) => <Text {...props}>[{name}]</Text>,
    Ionicons: ({ name, ...props }) => <Text {...props}>[{name}]</Text>,
    FontAwesome: ({ name, ...props }) => <Text {...props}>[{name}]</Text>,
  };
});

// Mock expo-audio
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioPlayer: jest.fn(() => ({
    playing: false,
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    seekTo: jest.fn(),
  })),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  Accuracy: { High: 4, Balanced: 3, Low: 1 },
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 28.6139,
      longitude: 77.2090,
      altitude: 216,
      accuracy: 5,
    },
  }),
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://mock/sky.jpg', mimeType: 'image/jpeg', width: 1080, height: 1920 }],
  }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://mock/sky.jpg', mimeType: 'image/jpeg', width: 1080, height: 1920 }],
  }),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExpoPushToken[MockToken12345]' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
