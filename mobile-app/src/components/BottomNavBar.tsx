import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';

export type TabKey = 'dashboard' | 'corridor' | 'forecast' | 'alerts' | 'mesh';

interface BottomNavBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onSelectTab }) => {
  const tabs: { key: TabKey; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { key: 'dashboard', label: 'Home', icon: 'blur' },
    { key: 'corridor', label: 'Corridor', icon: 'map-marker-path' },
    { key: 'forecast', label: '72h Plume', icon: 'weather-windy' },
    { key: 'alerts', label: 'Alerts', icon: 'alert-decagram' },
    { key: 'mesh', label: 'Mesh', icon: 'lan-connect' },
  ];

  return (
    <View style={styles.wrapper}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
              onPress={() => onSelectTab(tab.key)}
              style={({ pressed }) => [
                styles.tabItem,
                isActive && styles.tabItemActive,
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={20}
                color={isActive ? Colors.inkBlack : Colors.outlineVariant}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? Colors.inkBlack : Colors.outlineVariant },
                  isActive && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },
  navBar: {
    height: 60,
    backgroundColor: '#18181BEE',
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
  },
  tabItemActive: {
    backgroundColor: Colors.canvasCream,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  tabLabelActive: {
    fontWeight: '900',
  },
});
