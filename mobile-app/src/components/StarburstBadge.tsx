import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../theme/tokens';

interface StarburstBadgeProps {
  label: string;
  subLabel?: string;
  backgroundColor?: string;
  textColor?: string;
  shadowColor?: string;
  rotation?: string;
  style?: StyleProp<ViewStyle>;
}

export const StarburstBadge: React.FC<StarburstBadgeProps> = ({
  label,
  subLabel,
  backgroundColor = Colors.inkBlack,
  textColor = Colors.canvasCream,
  shadowColor = Colors.coralWatermelon,
  rotation = '-3deg',
  style,
}) => {
  return (
    <View style={[styles.wrapper, { transform: [{ rotate: rotation }] }, style]}>
      {/* Shadow */}
      <View style={[styles.shadow, { backgroundColor: shadowColor }]} />
      {/* Badge Content */}
      <View style={[styles.badge, { backgroundColor }]}>
        <Text style={[styles.text, { color: textColor }]}>{label}</Text>
        {subLabel ? <Text style={[styles.subText, { color: textColor }]}>{subLabel}</Text> : null}
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
