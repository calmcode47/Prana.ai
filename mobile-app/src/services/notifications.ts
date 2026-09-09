import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerMobilePushToken } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForIncidentPush(): Promise<string> {
  if (Platform.OS === 'web') return 'N/A — push notifications require a native app';
  if (!Device.isDevice) return 'N/A — push notifications require a physical device';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('prana-alerts', {
      name: 'PRANA Air Quality Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#EA580C',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return 'N/A — notification permission not granted';

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId;
  if (!projectId) return 'N/A — EAS project ID not configured';

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerMobilePushToken({
    expo_push_token: expoPushToken,
    platform: Platform.OS as 'android' | 'ios',
  });
  return 'registered';
}

export function subscribeToIncidentNotifications(
  onAlert: (title: string, body: string) => void,
): () => void {
  if (Platform.OS === 'web') return () => {};
  const received = Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    onAlert(content.title || 'Air Quality Alert', content.body || 'A new incident was recorded.');
  });
  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    const content = event.notification.request.content;
    onAlert(content.title || 'Air Quality Alert', content.body || 'A new incident was recorded.');
  });
  return () => {
    received.remove();
    response.remove();
  };
}
