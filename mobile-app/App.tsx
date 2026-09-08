import React, { useState } from 'react';
import { StyleSheet, View, Modal } from 'react-native';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <AirshedDashboardScreen
            onOpenScanner={() => setIsScannerOpen(true)}
            onNavigateCorridor={() => setActiveTab('corridor')}
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
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />

        {/* Main Screen Content */}
        <View style={styles.screenWrapper}>{renderActiveScreen()}</View>

        {/* Persistent Floating Audio Player */}
        <View style={styles.floatingPlayerContainer}>
          <FloatingAudioPlayer />
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
});
