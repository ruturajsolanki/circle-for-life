import { Types } from 'mongoose';
import { Post } from '../models/Post.model.js';
import { User } from '../models/User.model.js';
import { getRedis } from '../config/database.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';
import { env } from '../config/env.js';

// ─── Moderation Configuration ───────────────────────────────────────────────

const MODERATION_CONFIG = {
  // NSFW Detection
  NSFW_THRESHOLD: 0.7,              // score above this = auto-reject
  NSFW_REVIEW_THRESHOLD: 0.4,       // score above this = manual review

  // Toxicity Detection
  TOXICITY_THRESHOLD: 0.8,          // score above this = auto-reject
  TOXICITY_REVIEW_THRESHOLD: 0.5,   // score above this = manual review

  // Report-based thresholds
  REPORTS_FOR_AUTO_REVIEW: 3,       // auto-queue for review after N reports
  REPORTS_FOR_AUTO_REMOVE: 10,      // auto-remove after N reports

  // Shadow ban thresholds
  SHADOW_BAN_REPORT_THRESHOLD: 20,  // total reports to trigger shadow ban
  SHADOW_BAN_TRUST_THRESHOLD: 15,   // trust score below this = shadow ban

  // Banned content patterns
  BLOCKED_PROMPT_PATTERNS: [
    /child\s*(porn|nude|naked|sex)/i,
    /\b(cp|csam)\b/i,
    /minor\s*(nude|naked|sex)/i,
    /under\s*age\s*(nude|naked|sex)/i,
    /real\s*person.*nude/i,
    /deepfake.*nude/i,
    /revenge\s*porn/i,
  ],

  // Rate limits for reports
  MAX_REPORTS_PER_USER_PER_DAY: 10,
};

// ─── Moderation Pipeline ────────────────────────────────────────────────────
//
// The moderation pipeline is a multi-stage system:
//
// Stage 1: On-Device Pre-filter (Client-side)
//   - Local blocked word list
//   - Basic pattern matching
//   - Prevents obviously banned prompts from being sent
//
// Stage 2: Prompt Analysis (Server-side, synchronous)
//   - Regex pattern matching for blocked content
//   - Toxicity scoring via Perspective API
//   - Blocks generation BEFORE GPU cost is incurred
//
// Stage 3: Image Analysis (Async, post-generation)
//   - NSFW detection API
//   - Image hash matching (known bad images)
//   - Automated categorization
//
// Stage 4: Community Reporting (Async)
//   - User reports with structured reasons
//   - Threshold-based auto-actions
//   - Human review queue
//
// Stage 5: Human Review (Manual)
//   - Admin review dashboard
//   - Appeal processing
//   - Final decisions with audit trail

export class ModerationService {
  /**
   * Stage 2: Analyze a prompt before generation.
   * Returns whether the prompt is allowed and any warnings.
   *
   * This MUST be called before GPU generation to:
   * 1. Prevent wasted GPU cost on banned content
   * 2. Protect the platform from illegal content
   * 3. Maintain ethical standards
   */
  static async analyzePrompt(params: {
    prompt: string;
    refinedPrompt: string;
    userId: Types.ObjectId;
  }): Promise<{
    allowed: boolean;
    reason?: string;
    toxicityScore: number;
    flags: string[];
  }> {
    const { prompt, refinedPrompt, userId } = params;
    const flags: string[] = [];
    const textsToCheck = [prompt, refinedPrompt];

    // ─── Check 1: Blocked Patterns ────────────────────────────────────

    for (const text of textsToCheck) {
      for (const pattern of MODERATION_CONFIG.BLOCKED_PROMPT_PATTERNS) {
        if (pattern.test(text)) {
          logger.warn(`Blocked prompt pattern detected`, {
            userId: userId.toString(),
            pattern: pattern.source,
          });

          // Decrease trust score significantly
          await User.updateOne(
            { _id: userId },
            { $inc: { trustScore: -10 } }
          );

          return {
            allowed: false,
            reason: 'MOD_001: Content violates community guidelines',
            toxicityScore: 1.0,
            flags: ['blocked_pattern'],
          };
        }
      }
    }

    // ─── Check 2: Toxicity Analysis (Perspective API) ─────────────────

    let toxicityScore = 0;

    if (env.PERSPECTIVE_API_KEY) {
      try {
        toxicityScore = await this.checkToxicity(prompt);

        if (toxicityScore >= MODERATION_CONFIG.TOXICITY_THRESHOLD) {
          flags.push('high_toxicity');
          return {
            allowed: false,
            reason: 'MOD_001: Content may contain harmful language',
            toxicityScore,
            flags,
          };
        }

        if (toxicityScore >= MODERATION_CONFIG.TOXICITY_REVIEW_THRESHOLD) {
          flags.push('moderate_toxicity');
        }
      } catch (error) {
        logger.error('Toxicity API error:', error as any);
        // Fail open — don't block if API is down
      }
    }

    // ─── Check 3: User Trust Score ────────────────────────────────────

    const user = await User.findById(userId).select('trustScore shadowBanned').lean();
    if (user && user.trustScore < 10) {
      flags.push('low_trust_user');
    }
    if (user?.shadowBanned) {
      flags.push('shadow_banned');
    }

    return {
      allowed: true,
      toxicityScore,
      flags,
    };
  }

  /**
   * Stage 3: Analyze a generated image for NSFW content.
   * Called asynchronously after image generation.
   */
  static async analyzeImage(params: {
    postId: Types.ObjectId;
    imageUrl: string;
    userId: Types.ObjectId;
  }): Promise<{
    approved: boolean;
    nsfwScore: number;
    categories: string[];
    action: 'approve' | 'review' | 'reject';
  }> {
    const { postId, imageUrl, userId } = params;

    let nsfwScore = 0;
    let categories: string[] = [];

    // ─── NSFW Detection ───────────────────────────────────────────────

    if (env.NSFW_API_KEY) {
      try {
        const result = await this.checkNSFW(imageUrl);
        nsfwScore = result.score;
        categories = result.categories;
      } catch (error) {
        logger.error('NSFW API error:', error as any);
        // If NSFW API is down, queue for manual review
        await Post.updateOne(
          { _id: postId },
          { $set: { moderationStatus: 'pending', nsfwScore: 0 } }
        );
        return {
          approved: false,
          nsfwScore: 0,
          categories: [],
          action: 'review',
        };
      }
    }

    // ─── Decision Logic ───────────────────────────────────────────────

    let action: 'approve' | 'review' | 'reject';

    if (nsfwScore >= MODERATION_CONFIG.NSFW_THRESHOLD) {
      action = 'reject';

      await Post.updateOne(
        { _id: postId },
        {
          $set: {
            moderationStatus: 'rejected',
            nsfwScore,
            moderationReviewedBy: 'auto',
            moderationReviewedAt: new Date(),
            moderationNotes: `Auto-rejected: NSFW score ${nsfwScore.toFixed(2)}`,
          },
        }
      );

      // Penalize trust score
      await User.updateOne(
        { _id: userId },
        { $inc: { trustScore: -5 } }
      );

      logger.info(`Post ${postId} auto-rejected for NSFW content (score: ${nsfwScore})`);
    } else if (nsfwScore >= MODERATION_CONFIG.NSFW_REVIEW_THRESHOLD) {
      action = 'review';

      await Post.updateOne(
        { _id: postId },
        {
          $set: {
            moderationStatus: 'flagged',
            nsfwScore,
            moderationNotes: `Queued for review: NSFW score ${nsfwScore.toFixed(2)}`,
          },
        }
      );
    } else {
      action = 'approve';

      await Post.updateOne(
        { _id: postId },
        {
          $set: {
            moderationStatus: 'approved',
            nsfwScore,
            moderationReviewedBy: 'auto',
            moderationReviewedAt: new Date(),
          },
        }
      );
    }

    return {
      approved: action === 'approve',
      nsfwScore,
      categories,
      action,
    };
  }

  /**
   * Process a user report.
   */
  static async processReport(params: {
    reporterId: Types.ObjectId;
    targetType: 'post' | 'user';
    targetId: Types.ObjectId;
    reason: string;
    description?: string;
  }): Promise<{ reportId: string }> {
    const { reporterId, targetType, targetId, reason, description } = params;

    // Rate limit reports
    const redis = getRedis();
    const today = new Date().toISOString().split('T')[0];
    const rateLimitKey = `rate:report:${reporterId}:${today}`;
    const reportCount = await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, 86400);

    if (reportCount > MODERATION_CONFIG.MAX_REPORTS_PER_USER_PER_DAY) {
      throw new Error('Report rate limit exceeded');
    }

    // Create report (pseudo — would use Report model)
    const report = {
      _id: new Types.ObjectId(),
      reporterId,
      targetType,
      targetId,
      reason,
      description,
      status: 'pending',
      createdAt: new Date(),
    };

    // Check if target has reached auto-action thresholds
    if (targetType === 'post') {
      const post = await Post.findById(targetId);
      if (post) {
        const totalReports = await redis.incr(`reports:post:${targetId}`);
        await redis.expire(`reports:post:${targetId}`, 86400 * 7);

        if (totalReports >= MODERATION_CONFIG.REPORTS_FOR_AUTO_REMOVE) {
          await Post.updateOne(
            { _id: targetId },
            {
              $set: {
                moderationStatus: 'rejected',
                moderationNotes: `Auto-removed: ${totalReports} reports`,
                moderationReviewedBy: 'auto',
                moderationReviewedAt: new Date(),
              },
            }
          );
          logger.info(`Post ${targetId} auto-removed after ${totalReports} reports`);
        } else if (totalReports >= MODERATION_CONFIG.REPORTS_FOR_AUTO_REVIEW) {
          await Post.updateOne(
            { _id: targetId },
            { $set: { moderationStatus: 'flagged' } }
          );
        }
      }
    }

    if (targetType === 'user') {
      const targetUser = await User.findById(targetId);
      if (targetUser) {
        await User.updateOne(
          { _id: targetId },
          { $inc: { reportCount: 1 } }
        );

        // Auto shadow ban if report threshold reached
        if (
          targetUser.reportCount + 1 >=
          MODERATION_CONFIG.SHADOW_BAN_REPORT_THRESHOLD
        ) {
          await User.updateOne(
            { _id: targetId },
            { $set: { shadowBanned: true } }
          );
          logger.info(
            `User ${targetId} shadow-banned after ${targetUser.reportCount + 1} reports`
          );
        }
      }
    }

    return { reportId: report._id.toString() };
  }

  /**
   * Call toxicity analysis API (Google Perspective).
   */
  private static async checkToxicity(text: string): Promise<number> {
    try {
      const response = await axios.post(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${env.PERSPECTIVE_API_KEY}`,
        {
          comment: { text },
          languages: ['en'],
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            IDENTITY_ATTACK: {},
            THREAT: {},
            SEXUALLY_EXPLICIT: {},
          },
        }
      );

      const scores = response.data.attributeScores;
      const maxScore = Math.max(
        scores.TOXICITY?.summaryScore?.value || 0,
        scores.SEVERE_TOXICITY?.summaryScore?.value || 0,
        scores.IDENTITY_ATTACK?.summaryScore?.value || 0,
        scores.THREAT?.summaryScore?.value || 0,
        scores.SEXUALLY_EXPLICIT?.summaryScore?.value || 0
      );

      return maxScore;
    } catch (error) {
      logger.error('Perspective API error:', error as any);
      return 0; // Fail open
    }
  }

  /**
   * Call NSFW image detection API.
   * Returns a score and detected categories.
   */
  private static async checkNSFW(
    imageUrl: string
  ): Promise<{ score: number; categories: string[] }> {
    try {
      // Using a generic NSFW API interface.
      // In production, use: Sightengine, AWS Rekognition, or Google Vision AI.
      const response = await axios.post(
        'https://api.sightengine.com/1.0/check.json',
        {
          url: imageUrl,
          models: 'nudity-2.1,offensive,gore',
          api_user: env.NSFW_API_KEY?.split(':')[0],
          api_secret: env.NSFW_API_KEY?.split(':')[1],
        }
      );

      const nudity = response.data.nudity || {};
      const offensive = response.data.offensive || {};

      const nsfwScore = Math.max(
        nudity.sexual_activity || 0,
        nudity.sexual_display || 0,
        nudity.erotica || 0,
        offensive.prob || 0,
        response.data.gore?.prob || 0
      );

      const categories: string[] = [];
      if (nudity.sexual_activity > 0.5) categories.push('sexual_activity');
      if (nudity.sexual_display > 0.5) categories.push('sexual_display');
      if (offensive.prob > 0.5) categories.push('offensive');
      if ((response.data.gore?.prob || 0) > 0.5) categories.push('gore');

      return { score: nsfwScore, categories };
    } catch (error) {
      logger.error('NSFW API error:', error as any);
      throw error;
    }
  }

  /**
   * Get moderation queue for admin review.
   */
  static async getModerationQueue(params: {
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<any[]> {
    const { status = 'flagged', limit = 20, cursor } = params;

    const query: any = { moderationStatus: status };
    if (cursor) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const posts = await Post.find(query)
      .sort({ createdAt: 1 }) // Oldest first (FIFO)
      .limit(limit)
      .lean();

    return posts;
  }

  /**
   * Admin review action on a post or user.
   */
  static async reviewAction(params: {
    targetType: 'post' | 'user';
    targetId: Types.ObjectId;
    action: 'approve' | 'reject' | 'warn' | 'shadow_ban' | 'ban';
    reviewedBy: string;
    notes?: string;
  }): Promise<void> {
    const { targetType, targetId, action, reviewedBy, notes } = params;

    if (targetType === 'post') {
      const status =
        action === 'approve' ? 'approved' : 'rejected';

      await Post.updateOne(
        { _id: targetId },
        {
          $set: {
            moderationStatus: status,
            moderationReviewedBy: reviewedBy,
            moderationReviewedAt: new Date(),
            moderationNotes: notes,
          },
        }
      );
    }

    if (targetType === 'user') {
      switch (action) {
        case 'warn':
          // Send notification to user
          break;
        case 'shadow_ban':
          await User.updateOne(
            { _id: targetId },
            { $set: { shadowBanned: true } }
          );
          break;
        case 'ban':
          await User.updateOne(
            { _id: targetId },
            {
              $set: {
                shadowBanned: true,
                bannedAt: new Date(),
                banReason: notes,
              },
            }
          );
          break;
        case 'approve':
          await User.updateOne(
            { _id: targetId },
            {
              $set: {
                shadowBanned: false,
                bannedAt: null,
                banReason: null,
              },
            }
          );
          break;
      }
    }

    logger.info(
      `Moderation action: ${action} on ${targetType} ${targetId} by ${reviewedBy}`
    );
  }

  /**
   * Get appeals (stub — would use Appeal model).
   */
  static async getAppeals(params: {
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ appeals: any[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit || 20, 50);
    return { appeals: [], nextCursor: null };
  }

  /**
   * Submit an appeal (stub).
   */
  static async processAppeal(params: {
    userId: Types.ObjectId;
    targetType: 'post' | 'user';
    targetId: Types.ObjectId;
    reason: string;
    description?: string;
  }): Promise<{ appealId: string }> {
    return { appealId: new Types.ObjectId().toString() };
  }
}

export { MODERATION_CONFIG };
