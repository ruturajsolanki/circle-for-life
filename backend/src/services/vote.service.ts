import { Types } from 'mongoose';
import { Vote } from '../models/Vote.model.js';
import { Post } from '../models/Post.model.js';
import { User } from '../models/User.model.js';
import { getRedis } from '../config/database.js';
import { AntiFraudService } from './antifraud.service.js';
import { logger } from '../utils/logger.js';

// ─── Voting Configuration ───────────────────────────────────────────────────

const VOTE_CONFIG = {
  DAILY_VOTE_LIMIT: 100,
  UNDO_WINDOW_MS: 5 * 60 * 1000,  // 5 minutes to undo vote
  MIN_ACCOUNT_AGE_FOR_VOTING_MS: 60 * 60 * 1000, // 1 hour
  MIN_TRUST_SCORE_FOR_VOTING: 10,
};

// ─── Ranking Algorithm Configuration ────────────────────────────────────────

const RANKING_CONFIG = {
  // Engagement score weights
  VOTE_WEIGHT: 1.0,
  VIEW_WEIGHT: 0.01,
  SHARE_WEIGHT: 3.0,
  COMMENT_WEIGHT: 2.0,

  // Trending decay
  TRENDING_GRAVITY: 1.8,         // Higher = faster decay

  // Feed cache TTLs (seconds)
  TRENDING_CACHE_TTL: 60,
  NEW_CACHE_TTL: 30,
  PERSONALIZED_CACHE_TTL: 120,
};

// ─── Vote Service ───────────────────────────────────────────────────────────

export class VoteService {
  /**
   * Cast a vote on a post.
   *
   * Flow:
   * 1. Validate user can vote (not self-vote, not rate limited, etc.)
   * 2. Run anti-fraud scoring
   * 3. Create vote record
   * 4. Update post vote count (atomic increment)
   * 5. Update Redis real-time counter
   * 6. Recalculate ranking scores
   *
   * Returns the new vote count and remaining daily votes.
   */
  static async castVote(params: {
    userId: Types.ObjectId;
    postId: Types.ObjectId;
    deviceId: string;
    ipHash: string;
    sessionId?: string;
  }): Promise<{
    success: boolean;
    newVoteCount: number;
    dailyVotesRemaining: number;
    error?: string;
  }> {
    const { userId, postId, deviceId, ipHash, sessionId } = params;

    // ─── Step 1: Validations ────────────────────────────────────────────

    // Check post exists
    const post = await Post.findById(postId);
    if (!post || post.deletedAt) {
      return { success: false, newVoteCount: 0, dailyVotesRemaining: 0, error: 'POST_001' };
    }

    // Self-vote prevention
    if (post.userId.toString() === userId.toString()) {
      return { success: false, newVoteCount: post.voteCount, dailyVotesRemaining: 0, error: 'POST_002' };
    }

    // Check user
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, newVoteCount: 0, dailyVotesRemaining: 0, error: 'USER_001' };
    }

    // Shadow-banned users: vote is accepted silently but doesn't count
    if (user.shadowBanned) {
      return {
        success: true,
        newVoteCount: post.voteCount, // Don't actually increment
        dailyVotesRemaining: VOTE_CONFIG.DAILY_VOTE_LIMIT - user.dailyVotesUsed,
      };
    }

    // Account age check
    const accountAge = Date.now() - user.createdAt.getTime();
    if (accountAge < VOTE_CONFIG.MIN_ACCOUNT_AGE_FOR_VOTING_MS) {
      return { success: false, newVoteCount: post.voteCount, dailyVotesRemaining: 0, error: 'Account too new to vote' };
    }

    // Trust score check
    if (user.trustScore < VOTE_CONFIG.MIN_TRUST_SCORE_FOR_VOTING) {
      // Silent failure — don't reveal trust score mechanics
      return {
        success: true,
        newVoteCount: post.voteCount,
        dailyVotesRemaining: VOTE_CONFIG.DAILY_VOTE_LIMIT - user.dailyVotesUsed,
      };
    }

    // Daily vote limit
    const redis = getRedis();
    const dailyKey = `rate:vote:${userId}:${new Date().toISOString().split('T')[0]}`;
    const currentVotes = parseInt((await redis.get(dailyKey)) || '0', 10);

    if (currentVotes >= VOTE_CONFIG.DAILY_VOTE_LIMIT) {
      return {
        success: false,
        newVoteCount: post.voteCount,
        dailyVotesRemaining: 0,
        error: 'RATE_002',
      };
    }

    // Duplicate vote check
    const existingVote = await Vote.findOne({ postId, userId });
    if (existingVote) {
      return {
        success: false,
        newVoteCount: post.voteCount,
        dailyVotesRemaining: VOTE_CONFIG.DAILY_VOTE_LIMIT - currentVotes,
        error: 'POST_003',
      };
    }

    // ─── Step 2: Anti-Fraud Scoring ─────────────────────────────────────

    const fraudScore = await AntiFraudService.scoreVote({
      userId,
      postId,
      postAuthorId: post.userId,
      deviceId,
      ipHash,
      sessionId,
    });

    const flagged = fraudScore > 0.7;

    // ─── Step 3: Create Vote Record ─────────────────────────────────────

    const vote = await Vote.create({
      postId,
      userId,
      postAuthorId: post.userId,
      deviceId,
      ipHash,
      sessionId,
      fraudScore,
      flagged,
      gemAwarded: false,
    });

    // ─── Step 4: Update Post Counters ───────────────────────────────────

    // If flagged, the vote is recorded but doesn't affect counts
    if (!flagged) {
      await Post.updateOne(
        { _id: postId },
        { $inc: { voteCount: 1 } }
      );
    }

    // ─── Step 5: Update Redis Real-time Counter ─────────────────────────

    await redis.incr(dailyKey);
    await redis.expire(dailyKey, 86400);

    if (!flagged) {
      await redis.incr(`post:votes:${postId}`);
      await redis.expire(`post:votes:${postId}`, 86400);
    }

    // ─── Step 6: Recalculate Rankings ───────────────────────────────────

    if (!flagged) {
      await this.recalculatePostScores(postId);
    }

    // Update user vote count
    await User.updateOne(
      { _id: userId },
      { $inc: { totalVotesGiven: 1 } }
    );

    const newVoteCount = post.voteCount + (flagged ? 0 : 1);
    const dailyVotesRemaining = VOTE_CONFIG.DAILY_VOTE_LIMIT - currentVotes - 1;

    logger.info(
      `Vote cast: user=${userId} post=${postId} fraud=${fraudScore.toFixed(2)} flagged=${flagged}`
    );

    return {
      success: true,
      newVoteCount,
      dailyVotesRemaining: Math.max(0, dailyVotesRemaining),
    };
  }

  /**
   * Undo a vote within the allowed window.
   */
  static async undoVote(params: {
    userId: Types.ObjectId;
    postId: Types.ObjectId;
  }): Promise<{ success: boolean; newVoteCount: number }> {
    const { userId, postId } = params;

    const vote = await Vote.findOne({ postId, userId });
    if (!vote) {
      return { success: false, newVoteCount: 0 };
    }

    // Check undo window
    const voteAge = Date.now() - vote.createdAt.getTime();
    if (voteAge > VOTE_CONFIG.UNDO_WINDOW_MS) {
      return { success: false, newVoteCount: 0 };
    }

    // Cannot undo if gems already awarded
    if (vote.gemAwarded) {
      return { success: false, newVoteCount: 0 };
    }

    // Remove vote
    await Vote.deleteOne({ _id: vote._id });

    // Decrement counters if vote wasn't flagged
    if (!vote.flagged) {
      const updatedPost = await Post.findOneAndUpdate(
        { _id: postId, voteCount: { $gt: 0 } },
        { $inc: { voteCount: -1 } },
        { new: true }
      );

      await this.recalculatePostScores(postId);

      return {
        success: true,
        newVoteCount: updatedPost?.voteCount || 0,
      };
    }

    const post = await Post.findById(postId);
    return { success: true, newVoteCount: post?.voteCount || 0 };
  }

  /**
   * Recalculate all ranking scores for a post.
   * Called after vote changes.
   */
  static async recalculatePostScores(
    postId: Types.ObjectId
  ): Promise<void> {
    const post = await Post.findById(postId);
    if (!post) return;

    // Engagement score (weighted composite)
    const engagementScore =
      post.voteCount * RANKING_CONFIG.VOTE_WEIGHT +
      post.viewCount * RANKING_CONFIG.VIEW_WEIGHT +
      post.shareCount * RANKING_CONFIG.SHARE_WEIGHT +
      post.commentCount * RANKING_CONFIG.COMMENT_WEIGHT;

    // Trending score (time-decayed)
    const ageInHours =
      (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
    const trendingScore =
      (post.voteCount - 1) /
      Math.pow(ageInHours + 2, RANKING_CONFIG.TRENDING_GRAVITY);

    // Hot score (Wilson score lower bound)
    const n = post.voteCount + post.viewCount * 0.01;
    let hotScore = 0;
    if (n > 0) {
      const z = 1.96;
      const phat = post.voteCount / Math.max(n, 1);
      hotScore =
        (phat +
          (z * z) / (2 * n) -
          z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) /
        (1 + (z * z) / n);
    }

    await Post.updateOne(
      { _id: postId },
      {
        $set: {
          engagementScore: Math.round(engagementScore * 100) / 100,
          trendingScore: Math.round(trendingScore * 10000) / 10000,
          hotScore: Math.round(hotScore * 10000) / 10000,
        },
      }
    );

    // Update trending leaderboard in Redis
    const redis = getRedis();
    await redis.zadd('leaderboard:trending', trendingScore, postId.toString());
  }

  /**
   * Get daily vote status for a user.
   */
  static async getDailyStatus(
    userId: Types.ObjectId
  ): Promise<{
    votesUsed: number;
    votesRemaining: number;
    resetsAt: string;
  }> {
    const redis = getRedis();
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `rate:vote:${userId}:${today}`;
    const votesUsed = parseInt((await redis.get(dailyKey)) || '0', 10);

    // Calculate reset time (midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    return {
      votesUsed,
      votesRemaining: Math.max(0, VOTE_CONFIG.DAILY_VOTE_LIMIT - votesUsed),
      resetsAt: tomorrow.toISOString(),
    };
  }
}

export { VOTE_CONFIG, RANKING_CONFIG };
