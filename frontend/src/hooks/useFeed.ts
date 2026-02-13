/**
 * Circle for Life - Feed Hook
 * React Query infinite scroll with cursor pagination
 */

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '../config/api';

export type FeedTab = 'trending' | 'new' | 'following';

export interface PostAuthor {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface Post {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  blurhash?: string;
  prompt: string;
  caption?: string;
  tags?: string[];
  voteCount: number;
  hasVoted?: boolean;
  author: PostAuthor;
  createdAt: string;
  visibility: 'public' | 'followers' | 'private';
}

export interface FeedResponse {
  posts: Post[];
  nextCursor?: string;
}

const FEED_QUERY_KEY = 'feed';

const fetchFeed = async (tab: FeedTab, cursor?: string): Promise<FeedResponse> => {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);

  const endpoint = tab === 'trending'
    ? `/feed/trending?${params}&timeWindow=24h`
    : tab === 'new'
      ? `/feed/new?${params}`
      : `/feed/following?${params}`;

  const { data } = await apiClient.get<FeedResponse>(endpoint);
  return data;
};

export const useFeed = (tab: FeedTab) => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: [FEED_QUERY_KEY, tab],
    queryFn: ({ pageParam }) => fetchFeed(tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: tab === 'trending' ? 60_000 : 30_000, // 60s trending, 30s new/following
  });

  const posts = query.data?.pages.flatMap((p) => p.posts) ?? [];
  const hasNextPage = !!query.hasNextPage;
  const isFetchingNextPage = query.isFetchingNextPage;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, query]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [FEED_QUERY_KEY, tab] });
  }, [queryClient, tab]);

  const invalidatePost = useCallback(
    (postId: string) => {
      queryClient.setQueriesData(
        { queryKey: [FEED_QUERY_KEY, tab] },
        (old: { pages: FeedResponse[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p) =>
                p.id === postId
                  ? { ...p, voteCount: p.voteCount + 1, hasVoted: true }
                  : p
              ),
            })),
          };
        }
      );
    },
    [queryClient, tab]
  );

  return {
    posts,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isFetchingNextPage,
    hasNextPage,
    error: query.error,
    refetch: query.refetch,
    loadMore,
    refresh,
    invalidatePost,
  };
};
