import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  GestureResponderEvent,
} from 'react-native';
import { Colors } from '../theme/tokens';

interface NeoButtonProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  shadowColor?: string;
  shadowOffset?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  disabled?: boolean;
}

export const NeoButton: React.FC<NeoButtonProps> = ({
  children,
  onPress,
  style,
  backgroundColor = Colors.inkBlack,
  shadowColor = Colors.cobaltDeep,
  shadowOffset = 3,
  borderRadius = 9999,
  borderWidth = 1.5,
  borderColor = Colors.inkBlack,
  disabled = false,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, shadowOffset],
  });

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, shadowOffset],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={{
        marginRight: shadowOffset,
        marginBottom: shadowOffset,
      }}
    >
      <Animated.View
        style={[
          styles.shadow,
          {
            backgroundColor: shadowColor,
            borderRadius,
            top: shadowOffset,
            left: shadowOffset,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.content,
          {
            backgroundColor,
            borderRadius,
            borderWidth,
            borderColor,
            transform: [{ translateX }, { translateY }],
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shadow: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    overflow: 'hidden',
  },
});
