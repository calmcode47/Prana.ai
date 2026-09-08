import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../theme/tokens';

interface DualUnitChipProps {
  massValue: string | number;
  massUnit?: string;
  aqiValue: string | number;
  aqiLabel?: string;
  aqiColor?: string;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

export const DualUnitChip: React.FC<DualUnitChipProps> = ({
  massValue,
  massUnit = 'µg/m³ PM2.5',
  aqiValue,
  aqiLabel = 'AQI',
  aqiColor = Colors.coralWatermelon,
  style,
  backgroundColor = Colors.surfaceVanilla,
}) => {
  return (
    <View style={[styles.wrapper, style]}>
      {/* Hard offset shadow */}
      <View style={styles.shadow} />
      {/* Pill content */}
      <View style={[styles.container, { backgroundColor }]}>
        {/* Mass Sub-cell */}
        <View style={styles.subCell}>
          <Text style={styles.massValue}>{massValue}</Text>
          <Text style={styles.massUnit}> {massUnit}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* AQI Sub-cell */}
        <View style={styles.subCell}>
          <View style={[styles.statusDot, { backgroundColor: aqiColor }]} />
          <Text style={[styles.aqiValue, { color: aqiColor }]}>{aqiValue}</Text>
          <Text style={styles.aqiLabel}> {aqiLabel}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginRight: 2,
    marginBottom: 2,
  },
  shadow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.inkBlack,
    borderRadius: 9999,
    top: 2,
    left: 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
  },
  subCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  massValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  massUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  divider: {
    width: 1.5,
    height: 14,
    backgroundColor: Colors.outlineVariant,
    marginHorizontal: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
  },
  aqiValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  aqiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
});
