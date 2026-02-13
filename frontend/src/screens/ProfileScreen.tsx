/**
 * Circle for Life - User Profile Screen
 * Gem balance, streak, posts grid, settings
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useGemStore } from '../store/gemStore';
import { GemBadge } from '../components/GemBadge';
import { apiClient } from '../config/api';
import { Post } from '../hooks/useFeed';

interface UserPost {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  voteCount: number;
  createdAt: string;
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { balance, multiplier, fetchBalance } = useGemStore();

  const [posts, setPosts] = React.useState<UserPost[]>([]);
  const [streak, setStreak] = React.useState<{
    currentStreak: number;
    longestStreak: number;
    todayCheckedIn: boolean;
  } | null>(null);
  const [isLoadingPosts, setIsLoadingPosts] = React.useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBalance();
    }
  }, [isAuthenticated, fetchBalance]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const loadData = async () => {
      setIsLoadingPosts(true);
      try {
        const [postsRes, streakRes] = await Promise.all([
          apiClient.get<{ posts: UserPost[] }>(`/users/${user.id}/posts?limit=20`),
          apiClient.get<{ currentStreak: number; longestStreak: number; todayCheckedIn: boolean }>(
            '/users/me/streak'
          ),
        ]);
        setPosts(postsRes.data.posts);
        setStreak(streakRes.data);
      } catch {
        // Handle error
      } finally {
        setIsLoadingPosts(false);
      }
    };

    loadData();
  }, [isAuthenticated, user?.id]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.loginPrompt}>Sign in to view your profile</Text>
        <Pressable style={styles.loginButton}>
          <Text style={styles.loginButtonText}>Log in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.avatarSection}>
          <ExpoImage
            source={user?.avatarUrl ?? undefined}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.userInfo}>
            <Text style={styles.displayName}>
              {user?.displayName ?? user?.username}
            </Text>
            <Text style={styles.username}>@{user?.username}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <GemBadge count={balance} multiplier={multiplier} showMultiplier size="lg" />
          </View>
          <View style={styles.statBox}>
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={24} color="#FF9F43" />
              <Text style={styles.streakCount}>
                {streak?.currentStreak ?? 0}
              </Text>
            </View>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
        </View>

        {user?.bio && (
          <Text style={styles.bio} numberOfLines={3}>
            {user.bio}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Creations</Text>
        {isLoadingPosts ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#7DD3FC" />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Create your first image!</Text>
          </View>
        ) : (
          <View style={styles.postsGrid}>
            {posts.map((post) => (
              <ExpoImage
                key={post.id}
                source={{ uri: post.thumbnailUrl ?? post.imageUrl }}
                style={styles.gridImage}
                contentFit="cover"
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.settingsSection}>
        <Pressable style={styles.settingsRow}>
          <Ionicons name="person-outline" size={22} color="#8E8E93" />
          <Text style={styles.settingsLabel}>Edit profile</Text>
          <Ionicons name="chevron-forward" size={20} color="#636366" />
        </Pressable>
        <Pressable style={styles.settingsRow}>
          <Ionicons name="notifications-outline" size={22} color="#8E8E93" />
          <Text style={styles.settingsLabel}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color="#636366" />
        </Pressable>
        <Pressable style={styles.settingsRow}>
          <Ionicons name="diamond-outline" size={22} color="#8E8E93" />
          <Text style={styles.settingsLabel}>Gem store</Text>
          <Ionicons name="chevron-forward" size={20} color="#636366" />
        </Pressable>
        <Pressable style={[styles.settingsRow, styles.logoutRow]} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color="#FF6B6B" />
          <Text style={styles.logoutLabel}>Log out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0F',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 32,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1C1C1E',
  },
  userInfo: {
    marginLeft: 16,
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  username: {
    color: '#8E8E93',
    fontSize: 15,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 67, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  streakCount: {
    color: '#FF9F43',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 6,
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 6,
  },
  bio: {
    color: '#8E8E93',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  loader: {
    padding: 40,
    alignItems: 'center',
  },
  emptyPosts: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#E5E5EA',
    fontSize: 16,
  },
  emptySubtext: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 8,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridImage: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
  },
  settingsSection: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  settingsLabel: {
    flex: 1,
    color: '#E5E5EA',
    fontSize: 16,
  },
  logoutRow: {
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  logoutLabel: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  loginPrompt: {
    color: '#E5E5EA',
    fontSize: 18,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#7DD3FC',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginButtonText: {
    color: '#0D0D0F',
    fontSize: 16,
    fontWeight: '600',
  },
});
