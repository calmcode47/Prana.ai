import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Modal, Text, Pressable, Linking } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [backendDown, setBackendDown] = useState<boolean>(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [mobileRelease, setMobileRelease] = useState<MobileReleaseResponse | null>(null);
  const [broadcastAlert, setBroadcastAlert] = useState<string | null>(null);

  // ── Real-time WebSocket feed (delhi channel) ──────────────────────────────
  const { isConnected: wsConnected, wsError, lastMessage } = useWebSocket('delhi');

  // Listen for live alert broadcasts pushed over WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'alert') {
      const alertTitle = lastMessage.title || 'Air Quality Alert Broadcast';
      const alertBody = lastMessage.body || `Incident #${lastMessage.incident_id?.slice(0, 8)}`;
      setBroadcastAlert(`🚨 ${alertTitle}: ${alertBody}`);
    }
  }, [lastMessage]);

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
    fetchHealth()
      .then(() => setBackendDown(false))
      .catch(() => setBackendDown(true));
  }, []);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <AirshedDashboardScreen
            onOpenScanner={() => setIsScannerOpen(true)}
            onNavigateCorridor={() => setActiveTab('corridor')}
            liveMessage={lastMessage}
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
          />
        );
    }
  };

  const showBanner = (backendDown || wsError) && !bannerDismissed;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />

        {/* Real-time Emergency Broadcast Alert */}
        {broadcastAlert && (
          <View style={styles.alertBanner}>
            <MaterialCommunityIcons name="alert-decagram" size={16} color={Colors.canvasCream} />
            <Text style={styles.alertBannerText} numberOfLines={2}>
              {broadcastAlert}
            </Text>
            <Pressable onPress={() => setBroadcastAlert(null)} style={styles.bannerDismiss}>
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
            <Pressable onPress={() => setBannerDismissed(true)} style={styles.bannerDismiss}>
              <MaterialCommunityIcons name="close" size={14} color={Colors.canvasCream} />
            </Pressable>
          </View>
        )}

        {/* Optional update prompt */}
        {mobileRelease && (
          <Pressable
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

        {/* Persistent Floating Audio Player — wired to live AQI note */}
        <View style={styles.floatingPlayerContainer}>
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
          <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
            <CitizenScannerScreen onClose={() => setIsScannerOpen(false)} />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
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
    bottom: 74,
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
