/**
 * Circle for Life - Feed Post Card
 * Image, prompt, vote button, share, user info
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Post } from '../hooks/useFeed';
import { VoteButton } from './VoteButton';
import { sharePost } from '../utils/sharing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 16;
const IMAGE_SIZE = SCREEN_WIDTH - CARD_PADDING * 2;

interface PostCardProps {
  post: Post;
  onVote: (postId: string) => void;
  onPress?: (post: Post) => void;
}

export function PostCard({ post, onVote, onPress }: PostCardProps) {
  const [isSharing, setIsSharing] = React.useState(false);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSharing(true);
    try {
      await sharePost({
        postId: post.id,
        imageUrl: post.imageUrl,
        prompt: post.prompt,
        caption: post.caption,
        username: post.author.username,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onPress?.(post)}
        style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}
      >
        <View style={styles.header}>
          <View style={styles.authorRow}>
            <Image
              source={post.author.avatarUrl ?? undefined}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.authorInfo}>
              <Text style={styles.displayName} numberOfLines={1}>
                {post.author.displayName ?? post.author.username}
              </Text>
              <Text style={styles.username}>@{post.author.username}</Text>
            </View>
          </View>
        </View>

        <Image
          source={{ uri: post.imageUrl }}
          style={styles.image}
          contentFit="cover"
          placeholder={post.blurhash}
          placeholderContentFit="cover"
          transition={200}
        />

        <View style={styles.content}>
          <Text style={styles.prompt} numberOfLines={2}>
            {post.prompt}
          </Text>

          <View style={styles.actions}>
            <VoteButton
              voteCount={post.voteCount}
              hasVoted={post.hasVoted}
              onVote={() => onVote(post.id)}
              size="md"
            />
            <Pressable
              onPress={handleShare}
              disabled={isSharing}
              style={styles.shareButton}
              hitSlop={12}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#8E8E93" />
              ) : (
                <Ionicons name="share-outline" size={22} color="#8E8E93" />
              )}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
  },
  authorInfo: {
    marginLeft: 10,
    flex: 1,
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 1,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#2C2C2E',
  },
  content: {
    padding: 12,
  },
  prompt: {
    color: '#E5E5EA',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareButton: {
    padding: 4,
  },
});
