import { Types } from 'mongoose';
import { Post } from '../models/Post.model.js';
import { User } from '../models/User.model.js';
import { getRedis } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ─── Feed Configuration ─────────────────────────────────────────────────────

const FEED_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,

  // Cache TTLs (seconds)
  TRENDING_CACHE_TTL: 60,
  NEW_CACHE_TTL: 30,
  FOLLOWING_CACHE_TTL: 60,
  PERSONALIZED_CACHE_TTL: 120,

  // Personalization weights
  PERSONALIZATION: {
    CATEGORY_MATCH: 0.3,      // user's preferred categories
    FOLLOWING_BOOST: 0.5,     // posts from followed users
    ENGAGEMENT_SIGNAL: 0.2,   // user's engagement history
  },

  // Trending time windows
  TIME_WINDOWS: {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  },
};

// ─── Feed Service ───────────────────────────────────────────────────────────

export class FeedService {
  /**
   * Get trending feed.
   * Sorted by trendingScore (time-decayed engagement).
   * Cached in Redis for 60 seconds.
   */
  static async getTrending(params: {
    cursor?: string;
    limit?: number;
    timeWindow?: '24h' | '7d' | '30d';
  }): Promise<{
    posts: any[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(params.limit || FEED_CONFIG.DEFAULT_PAGE_SIZE, FEED_CONFIG.MAX_PAGE_SIZE);
    const timeWindow = params.timeWindow || '24h';
    const redis = getRedis();

    // Try cache
    const cacheKey = `feed:trending:${timeWindow}:${params.cursor || 'first'}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build query
    const windowMs = FEED_CONFIG.TIME_WINDOWS[timeWindow];
    const windowStart = new Date(Date.now() - windowMs);

    const query: any = {
      moderationStatus: 'approved',
      visibility: 'public',
      deletedAt: null,
      createdAt: { $gte: windowStart },
    };

    if (params.cursor) {
      // Cursor-based pagination using trendingScore + _id
      const cursorPost = await Post.findById(params.cursor).select('trendingScore').lean();
      if (cursorPost) {
        query.$or = [
          { trendingScore: { $lt: cursorPost.trendingScore } },
          {
            trendingScore: cursorPost.trendingScore,
            _id: { $lt: new Types.ObjectId(params.cursor) },
          },
        ];
      }
    }

    const posts = await Post.find(query)
      .sort({ trendingScore: -1, _id: -1 })
      .limit(limit + 1) // fetch one extra to determine if there's a next page
      .lean();

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? resultPosts[resultPosts.length - 1]._id.toString()
      : null;

    const result = { posts: resultPosts, nextCursor };

    // Cache result
    await redis.set(cacheKey, JSON.stringify(result), 'EX', FEED_CONFIG.TRENDING_CACHE_TTL);

    return result;
  }

  /**
   * Get new feed (chronological).
   */
  static async getNew(params: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    posts: any[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(params.limit || FEED_CONFIG.DEFAULT_PAGE_SIZE, FEED_CONFIG.MAX_PAGE_SIZE);
    const redis = getRedis();

    const cacheKey = `feed:new:${params.cursor || 'first'}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const query: any = {
      moderationStatus: 'approved',
      visibility: 'public',
      deletedAt: null,
    };

    if (params.cursor) {
      query._id = { $lt: new Types.ObjectId(params.cursor) };
    }

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? resultPosts[resultPosts.length - 1]._id.toString()
      : null;

    const result = { posts: resultPosts, nextCursor };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', FEED_CONFIG.NEW_CACHE_TTL);

    return result;
  }

  /**
   * Get following feed (posts from users the current user follows).
   */
  static async getFollowing(params: {
    userId: Types.ObjectId;
    cursor?: string;
    limit?: number;
  }): Promise<{
    posts: any[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(params.limit || FEED_CONFIG.DEFAULT_PAGE_SIZE, FEED_CONFIG.MAX_PAGE_SIZE);

    // Get followed user IDs
    const Follow = (await import('../models/Follow.model.js')).Follow;
    const follows = await Follow.find({ followerId: params.userId })
      .select('followingId')
      .lean();

    const followingIds = follows.map((f: any) => f.followingId);

    if (followingIds.length === 0) {
      return { posts: [], nextCursor: null };
    }

    const query: any = {
      userId: { $in: followingIds },
      moderationStatus: 'approved',
      deletedAt: null,
      visibility: { $in: ['public', 'followers'] },
    };

    if (params.cursor) {
      query._id = { $lt: new Types.ObjectId(params.cursor) };
    }

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? resultPosts[resultPosts.length - 1]._id.toString()
      : null;

    return { posts: resultPosts, nextCursor };
  }

  /**
   * Get personalized feed.
   *
   * Algorithm:
   * 1. Get user's interaction history (categories, liked posts)
   * 2. Fetch candidate posts from last 48 hours
   * 3. Score each post based on:
   *    - Category preference match
   *    - Following boost
   *    - Engagement score
   *    - Freshness
   * 4. Sort by composite score
   * 5. Apply diversity filter (avoid too many posts from same user/category)
   */
  static async getPersonalized(params: {
    userId: Types.ObjectId;
    cursor?: string;
    limit?: number;
  }): Promise<{
    posts: any[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(params.limit || FEED_CONFIG.DEFAULT_PAGE_SIZE, FEED_CONFIG.MAX_PAGE_SIZE);
    const redis = getRedis();

    const cacheKey = `feed:personalized:${params.userId}:${params.cursor || 'first'}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Get user preferences from vote history
    const Vote = (await import('../models/Vote.model.js')).Vote;
    const recentVotes = await Vote.find({ userId: params.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('postId')
      .lean();

    const votedPostIds = recentVotes.map((v: any) => v.postId);

    // Get category preferences from voted posts
    const votedPosts = await Post.find({ _id: { $in: votedPostIds } })
      .select('category')
      .lean();

    const categoryFreq: Record<string, number> = {};
    for (const post of votedPosts) {
      if (post.category) {
        categoryFreq[post.category] = (categoryFreq[post.category] || 0) + 1;
      }
    }

    // Get following IDs
    const Follow = (await import('../models/Follow.model.js')).Follow;
    const follows = await Follow.find({ followerId: params.userId })
      .select('followingId')
      .lean();
    const followingSet = new Set(follows.map((f: any) => f.followingId.toString()));

    // Fetch candidate posts (last 48 hours, not already voted on)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const candidates = await Post.find({
      moderationStatus: 'approved',
      visibility: 'public',
      deletedAt: null,
      createdAt: { $gte: cutoff },
      userId: { $ne: params.userId }, // exclude own posts
      _id: { $nin: votedPostIds },    // exclude already voted
    })
      .sort({ engagementScore: -1 })
      .limit(200) // Over-fetch for scoring
      .lean();

    // Score each candidate
    const totalVotedPosts = votedPosts.length || 1;
    const scoredCandidates = candidates.map((post) => {
      let score = 0;

      // Category preference
      if (post.category && categoryFreq[post.category]) {
        score +=
          FEED_CONFIG.PERSONALIZATION.CATEGORY_MATCH *
          (categoryFreq[post.category] / totalVotedPosts);
      }

      // Following boost
      if (followingSet.has(post.userId.toString())) {
        score += FEED_CONFIG.PERSONALIZATION.FOLLOWING_BOOST;
      }

      // Engagement signal (normalized)
      score +=
        FEED_CONFIG.PERSONALIZATION.ENGAGEMENT_SIGNAL *
        Math.min(1, post.engagementScore / 100);

      // Freshness boost
      const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
      score += Math.max(0, 0.2 * (1 - ageHours / 48));

      return { ...post, _personalScore: score };
    });

    // Sort by personal score
    scoredCandidates.sort((a, b) => b._personalScore - a._personalScore);

    // Diversity filter: max 3 posts per user, max 5 per category
    const userCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const diversified = scoredCandidates.filter((post) => {
      const uid = post.userId.toString();
      const cat = post.category || 'other';

      userCounts[uid] = (userCounts[uid] || 0) + 1;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      return userCounts[uid] <= 3 && categoryCounts[cat] <= 5;
    });

    // Paginate
    const startIdx = params.cursor
      ? diversified.findIndex((p) => p._id.toString() === params.cursor) + 1
      : 0;

    const paginated = diversified.slice(startIdx, startIdx + limit + 1);
    const hasMore = paginated.length > limit;
    const resultPosts = hasMore ? paginated.slice(0, limit) : paginated;

    // Clean up internal scores
    const cleanPosts = resultPosts.map(({ _personalScore, ...post }) => post);
    const nextCursor = hasMore
      ? cleanPosts[cleanPosts.length - 1]._id.toString()
      : null;

    const result = { posts: cleanPosts, nextCursor };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', FEED_CONFIG.PERSONALIZED_CACHE_TTL);

    return result;
  }

  /**
   * Get feed by category.
   */
  static async getCategory(params: {
    category: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    posts: any[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(params.limit || FEED_CONFIG.DEFAULT_PAGE_SIZE, FEED_CONFIG.MAX_PAGE_SIZE);

    const query: any = {
      category: params.category,
      moderationStatus: 'approved',
      visibility: 'public',
      deletedAt: null,
    };

    if (params.cursor) {
      query._id = { $lt: new Types.ObjectId(params.cursor) };
    }

    const posts = await Post.find(query)
      .sort({ trendingScore: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? resultPosts[resultPosts.length - 1]._id.toString()
      : null;

    return { posts: resultPosts, nextCursor };
  }
}

export { FEED_CONFIG };
