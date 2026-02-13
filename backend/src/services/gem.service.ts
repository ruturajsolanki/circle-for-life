import { Types } from 'mongoose';
import { User, IUser } from '../models/User.model.js';
import { GemTransaction, GemSource } from '../models/GemTransaction.model.js';
import { getRedis } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { v4 as uuid } from 'uuid';

// ─── Gem Economy Configuration ──────────────────────────────────────────────

const GEM_CONFIG = {
  // Earning rates
  VOTES_PER_GEM: 10,               // 10 valid votes = 1 gem to post author
  DAILY_LOGIN_GEMS: 5,             // flat daily login bonus
  STREAK_BONUS_TIERS: [
    { days: 3, bonus: 2 },          // 3-day streak: +2 extra gems
    { days: 7, bonus: 5 },          // 7-day streak: +5 extra gems
    { days: 14, bonus: 10 },        // 14-day streak: +10 extra gems
    { days: 30, bonus: 25 },        // 30-day streak: +25 extra gems
    { days: 100, bonus: 100 },      // 100-day streak: +100 extra gems
  ],
  TRENDING_BONUS: 10,              // bonus for hitting trending
  REFERRAL_BONUS: 10,              // gems for successful referral
  REFERRAL_MULTIPLIER: 2.0,        // 2x gem multiplier for referrer
  REFERRAL_BONUS_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Spending costs (in gems)
  COSTS: {
    FLUX_GENERATION: 5,            // premium model: Flux
    MIDJOURNEY_GENERATION: 10,     // premium model: Midjourney-level
    AD_FREE_24H: 20,              // 24h ad-free pass
    PROFILE_THEME: 50,            // custom profile theme
    GIFT_CARD_MINIMUM: 500,       // minimum for gift card redemption
  },

  // Economy Guards
  MAX_DAILY_EARN_FROM_VOTES: 50,  // cap daily gem income from votes
  MAX_GEM_BALANCE: 100000,        // absolute cap to prevent exploit hoarding
  MIN_TRUST_SCORE_FOR_GEMS: 20,   // users below this don't earn gems

  // Inflation Control
  // The total gems entering the system per day should be monitored.
  // If circulation velocity exceeds threshold, reduce earn rates dynamically.
  INFLATION_CHECK_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  MAX_DAILY_SYSTEM_GEM_EMISSION: 1000000, // system-wide daily cap
};

// ─── Core Gem Operations ────────────────────────────────────────────────────

export class GemService {
  /**
   * Award gems to a user with full ledger tracking.
   * Uses MongoDB transactions for atomicity.
   * Idempotent via idempotencyKey.
   */
  static async awardGems(params: {
    userId: Types.ObjectId;
    amount: number;
    source: GemSource;
    referenceId?: string;
    referenceType?: string;
    description: string;
    idempotencyKey?: string;
  }): Promise<{ transaction: any; newBalance: number } | null> {
    const key = params.idempotencyKey || uuid();

    // Idempotency check
    const existing = await GemTransaction.findOne({ idempotencyKey: key });
    if (existing) {
      logger.warn(`Duplicate gem transaction attempt: ${key}`);
      return null;
    }

    const user = await User.findById(params.userId);
    if (!user) throw new Error('User not found');

    // Trust score guard
    if (user.trustScore < GEM_CONFIG.MIN_TRUST_SCORE_FOR_GEMS) {
      logger.warn(`User ${user._id} trust score too low for gem earning: ${user.trustScore}`);
      return null;
    }

    // Balance cap guard
    if (user.gemBalance + params.amount > GEM_CONFIG.MAX_GEM_BALANCE) {
      logger.warn(`User ${user._id} would exceed max gem balance`);
      return null;
    }

    // Calculate effective amount with multiplier
    const multiplier = user.getEffectiveGemMultiplier();
    const effectiveAmount = Math.floor(params.amount * multiplier);

    // Atomic update
    const balanceBefore = user.gemBalance;
    const balanceAfter = balanceBefore + effectiveAmount;

    const transaction = await GemTransaction.create({
      userId: params.userId,
      type: 'earn',
      source: params.source,
      amount: effectiveAmount,
      balanceBefore,
      balanceAfter,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      multiplier,
      baseAmount: params.amount,
      description: params.description,
      idempotencyKey: key,
    });

    await User.updateOne(
      { _id: params.userId },
      {
        $inc: {
          gemBalance: effectiveAmount,
          totalGemsEarned: effectiveAmount,
        },
      }
    );

    // Update Redis cache
    const redis = getRedis();
    await redis.set(
      `user:gems:${params.userId}`,
      balanceAfter.toString(),
      'EX',
      300
    );

    logger.info(
      `Gems awarded: ${effectiveAmount} to user ${params.userId} from ${params.source}`
    );

    return { transaction, newBalance: balanceAfter };
  }

  /**
   * Spend gems with validation and ledger tracking.
   */
  static async spendGems(params: {
    userId: Types.ObjectId;
    amount: number;
    source: GemSource;
    referenceId?: string;
    referenceType?: string;
    description: string;
    idempotencyKey?: string;
  }): Promise<{ transaction: any; newBalance: number }> {
    const key = params.idempotencyKey || uuid();

    // Idempotency check
    const existing = await GemTransaction.findOne({ idempotencyKey: key });
    if (existing) {
      throw new Error('GEM_002: Transaction already processed');
    }

    const user = await User.findById(params.userId);
    if (!user) throw new Error('User not found');

    // Insufficient balance check
    if (user.gemBalance < params.amount) {
      throw new Error('GEM_001: Insufficient gems');
    }

    const balanceBefore = user.gemBalance;
    const balanceAfter = balanceBefore - params.amount;

    const transaction = await GemTransaction.create({
      userId: params.userId,
      type: 'spend',
      source: params.source,
      amount: -params.amount,
      balanceBefore,
      balanceAfter,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      multiplier: 1.0,
      baseAmount: params.amount,
      description: params.description,
      idempotencyKey: key,
    });

    // Atomic decrement with floor guard
    const result = await User.findOneAndUpdate(
      {
        _id: params.userId,
        gemBalance: { $gte: params.amount }, // prevent race condition
      },
      {
        $inc: {
          gemBalance: -params.amount,
          totalGemsSpent: params.amount,
        },
      },
      { new: true }
    );

    if (!result) {
      // Race condition: balance changed between check and update
      await GemTransaction.deleteOne({ _id: transaction._id });
      throw new Error('GEM_001: Insufficient gems (concurrent modification)');
    }

    // Update Redis cache
    const redis = getRedis();
    await redis.set(
      `user:gems:${params.userId}`,
      balanceAfter.toString(),
      'EX',
      300
    );

    logger.info(
      `Gems spent: ${params.amount} by user ${params.userId} on ${params.source}`
    );

    return { transaction, newBalance: balanceAfter };
  }

  /**
   * Process vote-based gem settlements.
   * Called by the gem settlement worker periodically.
   * Batch processes unawarded votes and converts them to gems.
   *
   * Algorithm:
   * 1. Find all unprocessed votes grouped by post author
   * 2. For each author: count votes / VOTES_PER_GEM = gems to award
   * 3. Apply daily earning cap
   * 4. Apply multiplier
   * 5. Create gem transactions
   * 6. Mark votes as processed
   */
  static async settleVoteGems(): Promise<{
    processedUsers: number;
    totalGemsAwarded: number;
  }> {
    const Vote = (await import('../models/Vote.model.js')).Vote;
    const batchId = uuid();
    let processedUsers = 0;
    let totalGemsAwarded = 0;

    // Aggregate unprocessed votes by post author
    const pendingVotes = await Vote.aggregate([
      { $match: { gemAwarded: false, flagged: false } },
      {
        $group: {
          _id: '$postAuthorId',
          voteCount: { $sum: 1 },
          voteIds: { $push: '$_id' },
        },
      },
    ]);

    for (const batch of pendingVotes) {
      const authorId = batch._id;
      const voteCount = batch.voteCount;
      const gemsToAward = Math.floor(voteCount / GEM_CONFIG.VOTES_PER_GEM);

      if (gemsToAward <= 0) continue;

      // Check daily earning cap
      const redis = getRedis();
      const dailyKey = `gems:daily:votes:${authorId}`;
      const currentDaily = parseInt((await redis.get(dailyKey)) || '0', 10);

      const cappedGems = Math.min(
        gemsToAward,
        GEM_CONFIG.MAX_DAILY_EARN_FROM_VOTES - currentDaily
      );

      if (cappedGems <= 0) continue;

      // Award gems
      const result = await this.awardGems({
        userId: authorId,
        amount: cappedGems,
        source: 'votes',
        referenceId: batchId,
        referenceType: 'vote_batch',
        description: `Earned ${cappedGems} gems from ${voteCount} votes`,
        idempotencyKey: `vote-batch-${batchId}-${authorId}`,
      });

      if (result) {
        // Mark votes as processed
        const processedVoteCount = cappedGems * GEM_CONFIG.VOTES_PER_GEM;
        const voteIdsToMark = batch.voteIds.slice(0, processedVoteCount);

        await Vote.updateMany(
          { _id: { $in: voteIdsToMark } },
          { $set: { gemAwarded: true, gemBatchId: batchId } }
        );

        // Update daily cap tracking
        await redis.incrby(dailyKey, cappedGems);
        await redis.expire(dailyKey, 86400);

        processedUsers++;
        totalGemsAwarded += result.newBalance - (result.transaction.balanceBefore || 0);
      }
    }

    logger.info(
      `Gem settlement complete: ${processedUsers} users, ${totalGemsAwarded} gems awarded`
    );

    return { processedUsers, totalGemsAwarded };
  }

  /**
   * Process daily login bonus with streak calculation.
   */
  static async processDailyLogin(
    userId: Types.ObjectId
  ): Promise<{
    gemsEarned: number;
    currentStreak: number;
    streakBonus: number;
  }> {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Already checked in today
    if (user.lastActiveDate === today) {
      return {
        gemsEarned: 0,
        currentStreak: user.currentStreak,
        streakBonus: 0,
      };
    }

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak: number;
    if (user.lastActiveDate === yesterdayStr) {
      newStreak = user.currentStreak + 1;
    } else {
      newStreak = 1; // streak broken
    }

    const longestStreak = Math.max(newStreak, user.longestStreak);

    // Calculate streak bonus
    let streakBonus = 0;
    for (const tier of GEM_CONFIG.STREAK_BONUS_TIERS) {
      if (newStreak >= tier.days) {
        streakBonus = tier.bonus;
      }
    }

    const totalGems = GEM_CONFIG.DAILY_LOGIN_GEMS + streakBonus;

    // Award gems
    await this.awardGems({
      userId,
      amount: totalGems,
      source: streakBonus > 0 ? 'streak_bonus' : 'daily_login',
      referenceType: 'streak',
      referenceId: `streak-${today}`,
      description: `Daily login: ${GEM_CONFIG.DAILY_LOGIN_GEMS} gems${
        streakBonus > 0 ? ` + ${streakBonus} streak bonus (${newStreak} days)` : ''
      }`,
      idempotencyKey: `daily-login-${userId}-${today}`,
    });

    // Update user streak
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          currentStreak: newStreak,
          longestStreak,
          lastActiveDate: today,
          lastLoginAt: new Date(),
        },
      }
    );

    return {
      gemsEarned: totalGems,
      currentStreak: newStreak,
      streakBonus,
    };
  }

  /**
   * Process referral bonus.
   * Awards gems to referrer and activates 2x multiplier.
   */
  static async processReferralBonus(
    referrerId: Types.ObjectId,
    referredUserId: Types.ObjectId
  ): Promise<void> {
    // Award referral gems
    await this.awardGems({
      userId: referrerId,
      amount: GEM_CONFIG.REFERRAL_BONUS,
      source: 'referral',
      referenceId: referredUserId.toString(),
      referenceType: 'referral',
      description: `Referral bonus for inviting a new user`,
      idempotencyKey: `referral-${referrerId}-${referredUserId}`,
    });

    // Activate 2x multiplier
    const bonusExpiry = new Date(
      Date.now() + GEM_CONFIG.REFERRAL_BONUS_DURATION_MS
    );

    await User.updateOne(
      { _id: referrerId },
      {
        $set: { referralBonusExpiresAt: bonusExpiry },
        $inc: { referralCount: 1 },
      }
    );

    logger.info(
      `Referral bonus activated for user ${referrerId}, expires at ${bonusExpiry}`
    );
  }

  /**
   * Get gem balance (cached).
   */
  static async getBalance(
    userId: Types.ObjectId
  ): Promise<{
    balance: number;
    pendingEarnings: number;
    multiplier: number;
    multiplierExpiresAt?: Date;
  }> {
    const redis = getRedis();
    const cached = await redis.get(`user:gems:${userId}`);

    let balance: number;
    if (cached !== null) {
      balance = parseInt(cached, 10);
    } else {
      const user = await User.findById(userId).select('gemBalance');
      balance = user?.gemBalance || 0;
      await redis.set(`user:gems:${userId}`, balance.toString(), 'EX', 300);
    }

    // Count pending (unprocessed) votes
    const Vote = (await import('../models/Vote.model.js')).Vote;
    const pendingVotes = await Vote.countDocuments({
      postAuthorId: userId,
      gemAwarded: false,
      flagged: false,
    });
    const pendingEarnings = Math.floor(
      pendingVotes / GEM_CONFIG.VOTES_PER_GEM
    );

    const user = await User.findById(userId).select(
      'referralBonusExpiresAt'
    );
    const multiplier = user
      ? user.getEffectiveGemMultiplier()
      : 1.0;

    return {
      balance,
      pendingEarnings,
      multiplier,
      multiplierExpiresAt: user?.referralBonusExpiresAt || undefined,
    };
  }

  /**
   * Economy health check — monitors inflation.
   * Returns system-wide gem metrics for the admin dashboard.
   */
  static async getEconomyHealth(): Promise<{
    totalGemsInCirculation: number;
    dailyEmission: number;
    dailyBurn: number;
    velocity: number;
    inflationRisk: 'low' | 'medium' | 'high';
  }> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400000);

    // Total gems in circulation (sum of all user balances)
    const circulationResult = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$gemBalance' } } },
    ]);
    const totalGemsInCirculation = circulationResult[0]?.total || 0;

    // Daily emission (gems earned in last 24h)
    const emissionResult = await GemTransaction.aggregate([
      {
        $match: {
          type: 'earn',
          createdAt: { $gte: dayAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const dailyEmission = emissionResult[0]?.total || 0;

    // Daily burn (gems spent in last 24h)
    const burnResult = await GemTransaction.aggregate([
      {
        $match: {
          type: 'spend',
          createdAt: { $gte: dayAgo },
        },
      },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } },
    ]);
    const dailyBurn = burnResult[0]?.total || 0;

    // Velocity: ratio of daily transactions to total supply
    const velocity =
      totalGemsInCirculation > 0
        ? (dailyEmission + dailyBurn) / totalGemsInCirculation
        : 0;

    // Inflation risk assessment
    let inflationRisk: 'low' | 'medium' | 'high';
    if (dailyEmission > dailyBurn * 3) {
      inflationRisk = 'high';
    } else if (dailyEmission > dailyBurn * 1.5) {
      inflationRisk = 'medium';
    } else {
      inflationRisk = 'low';
    }

    return {
      totalGemsInCirculation,
      dailyEmission,
      dailyBurn,
      velocity: Math.round(velocity * 1000) / 1000,
      inflationRisk,
    };
  }

  /**
   * Get transaction history for a user.
   */
  static async getTransactions(
    userId: Types.ObjectId,
    params: { limit?: number; cursor?: string }
  ): Promise<{ transactions: any[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit || 20, 50);
    const query: any = { userId };
    if (params.cursor) {
      query._id = { $lt: new Types.ObjectId(params.cursor) };
    }
    const transactions = await GemTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = transactions.length > limit;
    const result = hasMore ? transactions.slice(0, limit) : transactions;
    const nextCursor = hasMore
      ? result[result.length - 1]._id.toString()
      : null;
    return { transactions: result, nextCursor };
  }

  /**
   * Get gem store items (purchasables).
   */
  static async getStore(): Promise<any[]> {
    return [
      { id: 'ad_free_24h', cost: 20, name: 'Ad-Free 24h', type: 'ad_free_pass' },
      { id: 'profile_theme', cost: 50, name: 'Profile Theme', type: 'cosmetic' },
      { id: 'flux_generation', cost: 5, name: 'Flux Generation', type: 'model_unlock' },
      { id: 'gift_card', cost: 500, name: 'Gift Card', type: 'gift_card', minGems: 500 },
    ];
  }

  /**
   * Get gem leaderboard.
   */
  static async getLeaderboard(params: {
    limit?: number;
    period?: 'all' | 'weekly' | 'monthly';
  }): Promise<any[]> {
    const limit = Math.min(params.limit || 20, 100);
    const leaderboard = await User.find({ deletedAt: null })
      .select('username displayName avatarUrl gemBalance tier')
      .sort({ gemBalance: -1 })
      .limit(limit)
      .lean();
    return leaderboard.map((u, i) => ({
      rank: i + 1,
      userId: u._id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      gemBalance: u.gemBalance,
      tier: u.tier,
    }));
  }
}

export { GEM_CONFIG };
