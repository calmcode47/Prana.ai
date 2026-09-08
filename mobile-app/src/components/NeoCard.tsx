import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../theme/tokens';

interface NeoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
}

export const NeoCard: React.FC<NeoCardProps> = ({
  children,
  style,
  backgroundColor = Colors.surfaceVanilla,
  shadowOffset = { width: 3, height: 3 },
  shadowColor = Colors.inkBlack,
  borderRadius = 16,
  borderWidth = 1.5,
  borderColor = Colors.inkBlack,
}) => {
  return (
    <View style={[styles.wrapper, { borderRadius, marginBottom: shadowOffset.height, marginRight: shadowOffset.width }]}>
      {/* Background shadow layer */}
      <View
        style={[
          styles.shadowLayer,
          {
            backgroundColor: shadowColor,
            borderRadius,
            top: shadowOffset.height,
            left: shadowOffset.width,
          },
        ]}
      />
      {/* Foreground card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor,
            borderRadius,
            borderWidth,
            borderColor,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadowLayer: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    overflow: 'hidden',
  },
});
