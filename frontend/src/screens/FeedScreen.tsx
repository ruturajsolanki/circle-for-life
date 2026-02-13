/**
 * Circle for Life - Main Feed Screen
 * Infinite scroll, pull to refresh, trending/new/following tabs
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeed, FeedTab, Post } from '../hooks/useFeed';
import { PostCard } from '../components/PostCard';
import { apiClient } from '../config/api';
import { useAuthStore } from '../store/authStore';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New' },
  { key: 'following', label: 'Following' },
];

export function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = React.useState<FeedTab>('trending');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const {
    posts,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
    refresh,
    invalidatePost,
  } = useFeed(activeTab);

  const handleVote = useCallback(
    async (postId: string) => {
      try {
        await apiClient.post(`/posts/${postId}/vote`);
        invalidatePost(postId);
      } catch {
        // Handle rate limit or auth errors
      }
    },
    [invalidatePost]
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleEndReached = useCallback(() => {
    if (activeTab === 'following' && !isAuthenticated) return;
    loadMore();
  }, [loadMore, activeTab, isAuthenticated]);

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onVote={handleVote} />
    ),
    [handleVote]
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#7DD3FC" />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderHeader = useCallback(() => (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const disabled = tab.key === 'following' && !isAuthenticated;
        return (
          <Pressable
            key={tab.key}
            onPress={() => !disabled && setActiveTab(tab.key)}
            disabled={disabled}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabLabel,
                isActive && styles.tabLabelActive,
                disabled && styles.tabLabelDisabled,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  ), [activeTab, isAuthenticated]);

  const keyExtractor = useCallback((item: Post) => item.id, []);

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#7DD3FC" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to create something amazing!
            </Text>
          </View>
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor="#7DD3FC"
          />
        }
        contentContainerStyle={[
          styles.listContent,
          posts.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0F',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0F',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: 'rgba(125, 211, 252, 0.2)',
  },
  tabLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#7DD3FC',
  },
  tabLabelDisabled: {
    opacity: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#E5E5EA',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 8,
  },
});
