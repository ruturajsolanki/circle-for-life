import { Types } from 'mongoose';
import { getRedis } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ─── Analytics Service ──────────────────────────────────────────────────────

export class AnalyticsService {
  /**
   * Track an analytics event (stub).
   */
  static async track(params: {
    userId?: Types.ObjectId;
    deviceId?: string;
    sessionId?: string;
    event: string;
    properties?: Record<string, any>;
  }): Promise<void> {
    // Stub: would persist to analytics store (ClickHouse, BigQuery, etc.)
    logger.debug('Analytics event', params);
    const redis = getRedis();
    await redis.lpush(
      'analytics:events',
      JSON.stringify({
        ...params,
        userId: params.userId?.toString(),
        timestamp: new Date().toISOString(),
      })
    );
    await redis.ltrim('analytics:events', 0, 9999);
  }

  /**
   * Get feature flags for client (stub).
   */
  static async getFlags(userId?: Types.ObjectId): Promise<Record<string, boolean>> {
    // Stub: would fetch from LaunchDarkly, PostHog, or DB
    return {
      new_feed_algorithm: true,
      gem_leaderboard: true,
      personalized_recommendations: true,
    };
  }
}
