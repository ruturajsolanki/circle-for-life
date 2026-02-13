import { Types } from 'mongoose';
import { Vote } from '../models/Vote.model.js';
import { User } from '../models/User.model.js';
import { getRedis } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ─── Anti-Fraud Configuration ───────────────────────────────────────────────

const FRAUD_CONFIG = {
  // Thresholds
  FRAUD_FLAG_THRESHOLD: 0.7,        // votes with score > this are flagged
  FRAUD_AUTO_REJECT_THRESHOLD: 0.9, // votes with score > this are silently rejected
  
  // Signal weights (sum to ~1.0 for normalization)
  WEIGHTS: {
    VELOCITY: 0.20,           // voting too fast
    IP_CLUSTERING: 0.20,      // multiple accounts from same IP
    DEVICE_CLUSTERING: 0.15,  // multiple accounts from same device
    RECIPROCAL: 0.15,         // A votes for B, B votes for A pattern
    BURST: 0.10,              // burst of votes on a single post
    ACCOUNT_AGE: 0.10,        // new accounts voting
    BEHAVIORAL: 0.10,         // unusual patterns
  },

  // Velocity limits
  MAX_VOTES_PER_MINUTE: 5,
  MAX_VOTES_PER_HOUR: 30,

  // Clustering thresholds
  MAX_USERS_PER_IP_PER_DAY: 3,
  MAX_USERS_PER_DEVICE: 2,

  // Reciprocal voting
  RECIPROCAL_WINDOW_HOURS: 24,

  // Burst detection
  MAX_VOTES_ON_SINGLE_POST_PER_MINUTE: 10,

  // Account age
  NEW_ACCOUNT_THRESHOLD_HOURS: 24,

  // Trust score impact
  TRUST_PENALTY_PER_FLAGGED_VOTE: 2,
  TRUST_RECOVERY_PER_CLEAN_DAY: 1,
  MAX_TRUST_SCORE: 100,
  MIN_TRUST_SCORE: 0,
};

// ─── Anti-Fraud Service ─────────────────────────────────────────────────────

export class AntiFraudService {
  /**
   * Score a vote for fraud likelihood.
   * Returns a score from 0.0 (clean) to 1.0 (definitely fraud).
   * 
   * This is a multi-signal scoring system that evaluates:
   * 1. Voting velocity (too fast = suspicious)
   * 2. IP clustering (multiple accounts on same IP)
   * 3. Device clustering (multiple accounts on same device)
   * 4. Reciprocal voting patterns (vote rings)
   * 5. Burst detection (coordinated votes on one post)
   * 6. Account age (new accounts used for vote manipulation)
   * 7. Behavioral anomalies (unusual timing, patterns)
   */
  static async scoreVote(params: {
    userId: Types.ObjectId;
    postId: Types.ObjectId;
    postAuthorId: Types.ObjectId;
    deviceId: string;
    ipHash: string;
    sessionId?: string;
  }): Promise<number> {
    const { userId, postId, postAuthorId, deviceId, ipHash } = params;
    const redis = getRedis();

    const signals: Record<string, number> = {};

    try {
      // ─── Signal 1: Velocity ─────────────────────────────────────────

      const velocityScore = await this.checkVelocity(userId, redis);
      signals.velocity = velocityScore;

      // ─── Signal 2: IP Clustering ────────────────────────────────────

      const ipScore = await this.checkIPClustering(userId, ipHash, redis);
      signals.ipClustering = ipScore;

      // ─── Signal 3: Device Clustering ────────────────────────────────

      const deviceScore = await this.checkDeviceClustering(userId, deviceId, redis);
      signals.deviceClustering = deviceScore;

      // ─── Signal 4: Reciprocal Voting ────────────────────────────────

      const reciprocalScore = await this.checkReciprocalVoting(userId, postAuthorId);
      signals.reciprocal = reciprocalScore;

      // ─── Signal 5: Burst Detection ─────────────────────────────────

      const burstScore = await this.checkBurstVoting(postId, redis);
      signals.burst = burstScore;

      // ─── Signal 6: Account Age ──────────────────────────────────────

      const ageScore = await this.checkAccountAge(userId);
      signals.accountAge = ageScore;

      // ─── Signal 7: Behavioral ───────────────────────────────────────

      const behavioralScore = await this.checkBehavioral(userId, redis);
      signals.behavioral = behavioralScore;

      // ─── Weighted Score Calculation ─────────────────────────────────

      const weights = FRAUD_CONFIG.WEIGHTS;
      const totalScore =
        signals.velocity * weights.VELOCITY +
        signals.ipClustering * weights.IP_CLUSTERING +
        signals.deviceClustering * weights.DEVICE_CLUSTERING +
        signals.reciprocal * weights.RECIPROCAL +
        signals.burst * weights.BURST +
        signals.accountAge * weights.ACCOUNT_AGE +
        signals.behavioral * weights.BEHAVIORAL;

      const clampedScore = Math.min(1.0, Math.max(0.0, totalScore));

      // Log suspicious activity
      if (clampedScore > 0.5) {
        logger.warn(`Suspicious vote detected`, {
          userId: userId.toString(),
          postId: postId.toString(),
          score: clampedScore.toFixed(3),
          signals,
        });
      }

      // Update trust score if flagged
      if (clampedScore > FRAUD_CONFIG.FRAUD_FLAG_THRESHOLD) {
        await User.updateOne(
          { _id: userId },
          {
            $inc: { trustScore: -FRAUD_CONFIG.TRUST_PENALTY_PER_FLAGGED_VOTE },
            $max: { trustScore: FRAUD_CONFIG.MIN_TRUST_SCORE },
          }
        );
      }

      return clampedScore;
    } catch (error) {
      logger.error('Error scoring vote for fraud:', error);
      return 0; // Fail open — don't block legitimate votes
    }
  }

  /**
   * Check voting velocity (votes per minute/hour).
   */
  private static async checkVelocity(
    userId: Types.ObjectId,
    redis: any
  ): Promise<number> {
    const minuteKey = `fraud:velocity:minute:${userId}`;
    const hourKey = `fraud:velocity:hour:${userId}`;

    const [minuteCount, hourCount] = await Promise.all([
      redis.incr(minuteKey),
      redis.incr(hourKey),
    ]);

    // Set expiry on first increment
    if (minuteCount === 1) await redis.expire(minuteKey, 60);
    if (hourCount === 1) await redis.expire(hourKey, 3600);

    // Score based on how close to limits
    const minuteScore = Math.min(
      1.0,
      minuteCount / FRAUD_CONFIG.MAX_VOTES_PER_MINUTE
    );
    const hourScore = Math.min(
      1.0,
      hourCount / FRAUD_CONFIG.MAX_VOTES_PER_HOUR
    );

    return Math.max(minuteScore, hourScore);
  }

  /**
   * Check if multiple accounts are voting from the same IP.
   */
  private static async checkIPClustering(
    userId: Types.ObjectId,
    ipHash: string,
    redis: any
  ): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `fraud:ip:${ipHash}:${today}`;

    await redis.sadd(key, userId.toString());
    await redis.expire(key, 86400);

    const uniqueUsers = await redis.scard(key);

    if (uniqueUsers <= 1) return 0;
    if (uniqueUsers <= FRAUD_CONFIG.MAX_USERS_PER_IP_PER_DAY) return 0.3;
    return Math.min(1.0, uniqueUsers / (FRAUD_CONFIG.MAX_USERS_PER_IP_PER_DAY * 2));
  }

  /**
   * Check if multiple accounts share the same device.
   */
  private static async checkDeviceClustering(
    userId: Types.ObjectId,
    deviceId: string,
    redis: any
  ): Promise<number> {
    const key = `fraud:device:${deviceId}`;

    await redis.sadd(key, userId.toString());
    await redis.expire(key, 86400 * 30); // 30 days

    const uniqueUsers = await redis.scard(key);

    if (uniqueUsers <= 1) return 0;
    if (uniqueUsers <= FRAUD_CONFIG.MAX_USERS_PER_DEVICE) return 0.2;
    return Math.min(1.0, 0.5 + (uniqueUsers - FRAUD_CONFIG.MAX_USERS_PER_DEVICE) * 0.2);
  }

  /**
   * Detect reciprocal voting patterns (vote rings).
   * If user A votes for author B, check if B recently voted for A's posts.
   */
  private static async checkReciprocalVoting(
    voterId: Types.ObjectId,
    postAuthorId: Types.ObjectId
  ): Promise<number> {
    const windowStart = new Date(
      Date.now() - FRAUD_CONFIG.RECIPROCAL_WINDOW_HOURS * 60 * 60 * 1000
    );

    // Check if the post author has voted for the voter's posts recently
    const reciprocalVotes = await Vote.countDocuments({
      userId: postAuthorId,
      postAuthorId: voterId,
      createdAt: { $gte: windowStart },
    });

    if (reciprocalVotes === 0) return 0;
    if (reciprocalVotes === 1) return 0.3;
    if (reciprocalVotes <= 3) return 0.6;
    return 0.9; // Strong reciprocal pattern
  }

  /**
   * Detect coordinated burst voting on a single post.
   */
  private static async checkBurstVoting(
    postId: Types.ObjectId,
    redis: any
  ): Promise<number> {
    const key = `fraud:burst:${postId}`;

    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);

    if (count <= 3) return 0;
    if (count <= FRAUD_CONFIG.MAX_VOTES_ON_SINGLE_POST_PER_MINUTE) return 0.3;
    return Math.min(
      1.0,
      count / (FRAUD_CONFIG.MAX_VOTES_ON_SINGLE_POST_PER_MINUTE * 2)
    );
  }

  /**
   * Check account age — new accounts are more likely to be bots.
   */
  private static async checkAccountAge(
    userId: Types.ObjectId
  ): Promise<number> {
    const user = await User.findById(userId).select('createdAt').lean();
    if (!user) return 0.5;

    const ageHours =
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);

    if (ageHours < 1) return 0.8;
    if (ageHours < FRAUD_CONFIG.NEW_ACCOUNT_THRESHOLD_HOURS) {
      return 0.5 * (1 - ageHours / FRAUD_CONFIG.NEW_ACCOUNT_THRESHOLD_HOURS);
    }
    return 0;
  }

  /**
   * Check behavioral anomalies.
   * - Voting without viewing (no view events)
   * - Voting at unusual times
   * - Voting in perfectly regular intervals (bot-like)
   */
  private static async checkBehavioral(
    userId: Types.ObjectId,
    redis: any
  ): Promise<number> {
    // Check voting interval regularity
    const recentVotes = await Vote.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('createdAt')
      .lean();

    if (recentVotes.length < 3) return 0;

    // Calculate intervals between votes
    const intervals: number[] = [];
    for (let i = 0; i < recentVotes.length - 1; i++) {
      const interval =
        new Date(recentVotes[i].createdAt).getTime() -
        new Date(recentVotes[i + 1].createdAt).getTime();
      intervals.push(interval);
    }

    // Check for suspiciously regular intervals (bot behavior)
    if (intervals.length >= 3) {
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance =
        intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        intervals.length;
      const coefficientOfVariation = Math.sqrt(variance) / (mean || 1);

      // Very low CV = very regular intervals = likely bot
      if (coefficientOfVariation < 0.1 && mean < 5000) {
        return 0.9;
      }
      if (coefficientOfVariation < 0.2 && mean < 10000) {
        return 0.5;
      }
    }

    return 0;
  }

  /**
   * Daily trust score recovery for clean users.
   * Called by a scheduled job.
   */
  static async recoverTrustScores(): Promise<number> {
    const result = await User.updateMany(
      {
        trustScore: { $lt: FRAUD_CONFIG.MAX_TRUST_SCORE },
        shadowBanned: false,
      },
      {
        $inc: { trustScore: FRAUD_CONFIG.TRUST_RECOVERY_PER_CLEAN_DAY },
        $min: { trustScore: FRAUD_CONFIG.MAX_TRUST_SCORE },
      }
    );

    logger.info(
      `Trust score recovery: ${result.modifiedCount} users recovered`
    );

    return result.modifiedCount;
  }

  /**
   * Detect and flag suspicious accounts for manual review.
   * Returns users that should be reviewed.
   */
  static async detectSuspiciousAccounts(): Promise<any[]> {
    // Find users with high flagged vote ratio
    const suspiciousUsers = await Vote.aggregate([
      {
        $group: {
          _id: '$userId',
          totalVotes: { $sum: 1 },
          flaggedVotes: {
            $sum: { $cond: ['$flagged', 1, 0] },
          },
        },
      },
      {
        $addFields: {
          flaggedRatio: {
            $cond: [
              { $gt: ['$totalVotes', 0] },
              { $divide: ['$flaggedVotes', '$totalVotes'] },
              0,
            ],
          },
        },
      },
      {
        $match: {
          totalVotes: { $gte: 10 },
          flaggedRatio: { $gte: 0.3 },
        },
      },
      { $sort: { flaggedRatio: -1 } },
      { $limit: 100 },
    ]);

    return suspiciousUsers;
  }
}

export { FRAUD_CONFIG };
