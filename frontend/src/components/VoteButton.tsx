/**
 * Circle for Life - Vote Button
 * Haptic feedback and animation on vote
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface VoteButtonProps {
  voteCount: number;
  hasVoted?: boolean;
  onVote: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const SIZES = {
  sm: { icon: 18, text: 12 },
  md: { icon: 22, text: 14 },
  lg: { icon: 26, text: 16 },
} as const;

export function VoteButton({
  voteCount,
  hasVoted = false,
  onVote,
  disabled = false,
  size = 'md',
  style,
}: VoteButtonProps) {
  const scale = useSharedValue(1);
  const { icon: iconSize, text: textSize } = SIZES[size];

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(1.2, { damping: 10 }),
      withSpring(1)
    );
    onVote();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.container, animatedStyle, style]}
      accessibilityLabel={`${voteCount} votes. ${hasVoted ? 'You voted' : 'Vote'}`}
      accessibilityRole="button"
    >
      <Ionicons
        name={hasVoted ? 'heart' : 'heart-outline'}
        size={iconSize}
        color={hasVoted ? '#FF6B9D' : '#8E8E93'}
      />
      <Text
        style={[
          styles.count,
          { fontSize: textSize },
          hasVoted && styles.countVoted,
        ]}
      >
        {voteCount >= 1000 ? `${(voteCount / 1000).toFixed(1)}k` : voteCount}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  count: {
    color: '#8E8E93',
    fontWeight: '600',
  },
  countVoted: {
    color: '#FF6B9D',
  },
});
