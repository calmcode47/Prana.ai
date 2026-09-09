import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../theme/tokens';

export type BadgeSeverity =
  | 'good'
  | 'satisfactory'
  | 'moderate'
  | 'poor'
  | 'very_poor'
  | 'severe'
  | 'emergency'
  | 'warning'
  | 'watch';

interface StarburstBadgeProps {
  label: string;
  subLabel?: string;
  severity?: BadgeSeverity;
  backgroundColor?: string;
  textColor?: string;
  shadowColor?: string;
  rotation?: string;
  style?: StyleProp<ViewStyle>;
}

const SEVERITY_PALETTES: Record<BadgeSeverity, { bg: string; text: string; shadow: string }> = {
  good: { bg: '#10B981', text: '#FFFFFF', shadow: '#065F46' },
  satisfactory: { bg: '#92D050', text: '#18181B', shadow: '#3F6212' },
  moderate: { bg: '#F59E0B', text: '#18181B', shadow: '#92400E' },
  poor: { bg: '#FF7800', text: '#FFFFFF', shadow: '#9A3412' },
  very_poor: { bg: '#EF4444', text: '#FFFFFF', shadow: '#991B1B' },
  severe: { bg: '#8F3F97', text: '#FFFFFF', shadow: '#581C87' },
  emergency: { bg: Colors.coralWatermelonVivid, text: '#FFFFFF', shadow: '#18181B' },
  warning: { bg: Colors.terracottaDeep, text: '#FFFFFF', shadow: '#18181B' },
  watch: { bg: Colors.cobaltDeep, text: '#FFFFFF', shadow: '#1E3A8A' },
};

export const StarburstBadge: React.FC<StarburstBadgeProps> = ({
  label,
  subLabel,
  severity,
  backgroundColor,
  textColor,
  shadowColor,
  rotation = '-3deg',
  style,
}) => {
  const palette = severity ? SEVERITY_PALETTES[severity] : null;
  const resolvedBg = backgroundColor ?? palette?.bg ?? Colors.inkBlack;
  const resolvedText = textColor ?? palette?.text ?? Colors.canvasCream;
  const resolvedShadow = shadowColor ?? palette?.shadow ?? Colors.coralWatermelon;
  return (
    <View style={[styles.wrapper, { transform: [{ rotate: rotation }] }, style]}>
      {/* Shadow */}
      <View style={[styles.shadow, { backgroundColor: resolvedShadow }]} />
      {/* Badge Content */}
      <View style={[styles.badge, { backgroundColor: resolvedBg }]}>
        <Text style={[styles.text, { color: resolvedText }]}>{label}</Text>
        {subLabel ? <Text style={[styles.subText, { color: resolvedText }]}>{subLabel}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  shadow: {
    ...StyleSheet.absoluteFill,
    top: 2,
    left: 2,
    borderRadius: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
