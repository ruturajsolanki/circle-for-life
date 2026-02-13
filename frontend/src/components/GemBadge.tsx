/**
 * Circle for Life - Animated Gem Counter Badge
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface GemBadgeProps {
  count: number;
  multiplier?: number;
  showMultiplier?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const SIZES = {
  sm: { icon: 14, text: 12 },
  md: { icon: 18, text: 14 },
  lg: { icon: 24, text: 18 },
} as const;

export function GemBadge({
  count,
  multiplier = 1,
  showMultiplier = false,
  size = 'md',
  style,
}: GemBadgeProps) {
  const scale = useSharedValue(1);
  const prevCount = useSharedValue(count);
  const { icon: iconSize, text: textSize } = SIZES[size];

  useEffect(() => {
    if (count !== prevCount.value) {
      scale.value = withSequence(
        withSpring(1.15, { damping: 8 }),
        withSpring(1)
      );
      prevCount.value = count;
    }
  }, [count, prevCount, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      <Ionicons
        name="diamond"
        size={iconSize}
        color="#7DD3FC"
        style={styles.icon}
      />
      <Text style={[styles.count, { fontSize: textSize }]}>
        {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
      </Text>
      {showMultiplier && multiplier > 1 && (
        <View style={styles.multiplierBadge}>
          <Text style={styles.multiplierText}>×{multiplier}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(125, 211, 252, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  icon: {
    marginRight: 4,
  },
  count: {
    color: '#7DD3FC',
    fontWeight: '700',
  },
  multiplierBadge: {
    marginLeft: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  multiplierText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '800',
  },
});
