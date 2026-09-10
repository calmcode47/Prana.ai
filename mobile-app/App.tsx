import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Modal, Text, Pressable, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { setAudioModeAsync } from 'expo-audio';
import { Colors } from './src/theme/tokens';
import { BottomNavBar, TabKey } from './src/components/BottomNavBar';
import { FloatingAudioPlayer } from './src/components/FloatingAudioPlayer';
import { AirshedDashboardScreen } from './src/screens/AirshedDashboardScreen';
import { AirCorridorMapScreen } from './src/screens/AirCorridorMapScreen';
import { PlumeForecastScreen } from './src/screens/PlumeForecastScreen';
import { FederatedMeshScreen } from './src/screens/FederatedMeshScreen';
import { RegulatoryAlertsScreen } from './src/screens/RegulatoryAlertsScreen';
import { CitizenScannerScreen } from './src/screens/CitizenScannerScreen';
import { fetchHealth, fetchMobileRelease, MobileReleaseResponse } from './src/api/client';
import { useWebSocket } from './src/hooks/useWebSocket';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { registerForIncidentPush, subscribeToIncidentNotifications } from './src/services/notifications';

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [backendDown, setBackendDown] = useState<boolean>(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [mobileRelease, setMobileRelease] = useState<MobileReleaseResponse | null>(null);

  // Alert queue to prevent push & websocket collisions
  const [alertQueue, setAlertQueue] = useState<string[]>([]);
  const currentAlert = alertQueue[0] ?? null;

  const enqueueAlert = useCallback((msg: string) => {
    setAlertQueue((prev) => (prev.includes(msg) ? prev : [...prev, msg]));
  }, []);

  const dismissCurrentAlert = useCallback(() => {
    setAlertQueue((prev) => prev.slice(1));
  }, []);

  // Configure system audio session once at startup
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  // ── Real-time WebSocket feed (delhi channel) ──────────────────────────────
  const { isConnected: wsConnected, wsError, lastMessage } = useWebSocket('delhi');

  // Listen for live alert broadcasts pushed over WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'alert') {
      const alertTitle = lastMessage.title || 'Air Quality Alert Broadcast';
      const alertBody = lastMessage.body || `Incident #${lastMessage.incident_id?.slice(0, 8)}`;
      enqueueAlert(`🚨 ${alertTitle}: ${alertBody}`);
    }
  }, [lastMessage, enqueueAlert]);

  // Check for app updates
  useEffect(() => {
    fetchMobileRelease()
      .then((rel) => {
        if (rel && rel.download_url) {
          setMobileRelease(rel);
        }
      })
      .catch(() => {});
  }, []);

  // Latest live AQI from WebSocket push, used by FloatingAudioPlayer label
  const liveAqiNote = lastMessage?.aqi_index != null
    ? `Delhi AQI ${lastMessage.aqi_index} · ${wsConnected ? 'Live' : 'Reconnecting…'}`
    : wsConnected
      ? 'Connected — awaiting snapshot'
      : 'Connecting to live feed…';

  // ── Backend health check on mount ─────────────────────────────────────────
  useEffect(() => {
    const checkHealth = () => fetchHealth()
      .then(() => setBackendDown(false))
      .catch(() => setBackendDown(true));
    checkHealth();
    const timer = setInterval(checkHealth, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    registerForIncidentPush().catch((error: unknown) => {
      console.warn('[Notifications] registration:', error instanceof Error ? error.message : error);
    });
    return subscribeToIncidentNotifications((title, body) => {
      enqueueAlert(`🚨 ${title}: ${body}`);
    });
  }, [enqueueAlert]);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <AirshedDashboardScreen
            onOpenScanner={() => setIsScannerOpen(true)}
            onNavigateCorridor={() => setActiveTab('corridor')}
            liveMessage={lastMessage}
            insets={insets}
          />
        );
      case 'corridor':
        return <AirCorridorMapScreen />;
      case 'forecast':
        return <PlumeForecastScreen />;
      case 'alerts':
        return <RegulatoryAlertsScreen />;
      case 'mesh':
        return <FederatedMeshScreen />;
      default:
        return (
          <AirshedDashboardScreen
            onOpenScanner={() => setIsScannerOpen(true)}
            onNavigateCorridor={() => setActiveTab('corridor')}
            liveMessage={lastMessage}
            insets={insets}
          />
        );
    }
  };

  const showBanner = (backendDown || wsError) && !bannerDismissed;
  const hasDarkBanner = Boolean(showBanner || currentAlert);
  const floatingBottom = Math.max(74, insets.bottom + 62);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style={hasDarkBanner ? 'light' : 'dark'} />

      {/* Real-time Emergency Broadcast Alert Queue */}
      {currentAlert && (
        <View style={styles.alertBanner}>
          <MaterialCommunityIcons name="alert-decagram" size={16} color={Colors.canvasCream} />
          <Text style={styles.alertBannerText} numberOfLines={2}>
            {currentAlert}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss alert"
            onPress={dismissCurrentAlert}
            style={styles.bannerDismiss}
          >
            <MaterialCommunityIcons name="close" size={14} color={Colors.canvasCream} />
          </Pressable>
        </View>
      )}

      {/* Backend connectivity banner */}
      {showBanner && (
        <View style={styles.connectivityBanner}>
          <MaterialCommunityIcons
            name={backendDown ? 'wifi-off' : 'wifi-strength-1-alert'}
            size={15}
            color={Colors.canvasCream}
          />
          <Text style={styles.bannerText}>
            {backendDown
              ? 'Backend unreachable — showing cached data'
              : wsError ?? 'Real-time feed reconnecting…'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss connectivity banner"
            onPress={() => setBannerDismissed(true)}
            style={styles.bannerDismiss}
          >
            <MaterialCommunityIcons name="close" size={14} color={Colors.canvasCream} />
          </Pressable>
        </View>
      )}

      {/* Optional update prompt */}
      {mobileRelease && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Update to version ${mobileRelease.version}`}
          onPress={() => Linking.openURL(mobileRelease.download_url)}
          style={styles.updateBanner}
        >
          <MaterialCommunityIcons name="cellphone-arrow-down" size={15} color={Colors.inkBlack} />
          <Text style={styles.updateBannerText}>
            Update v{mobileRelease.version} available · Tap to install
          </Text>
          <MaterialCommunityIcons name="arrow-right" size={14} color={Colors.inkBlack} />
        </Pressable>
      )}

      {/* Main Screen Content */}
      <View style={styles.screenWrapper}>{renderActiveScreen()}</View>

      {/* Persistent Floating Audio Player — dynamic bottom offset for gesture nav */}
      <View style={[styles.floatingPlayerContainer, { bottom: floatingBottom }]}>
        <FloatingAudioPlayer telemetryNote={liveAqiNote} />
      </View>

      {/* Bottom Pill Navigation Bar */}
      <BottomNavBar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Citizen Sky Haze Scanner Modal */}
      <Modal
        visible={isScannerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsScannerOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
            <CitizenScannerScreen onClose={() => setIsScannerOpen(false)} />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvasCream,
  },
  connectivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.terracottaDeep,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.canvasCream,
    letterSpacing: 0.2,
  },
  bannerDismiss: {
    padding: 2,
  },
  screenWrapper: {
    flex: 1,
  },
  floatingPlayerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.canvasCream,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.aqiHazardous,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.inkBlack,
  },
  alertBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.canvasCream,
    letterSpacing: 0.1,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVanillaStrong,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  updateBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
});
