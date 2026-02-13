import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedis } from '../config/database.js';

/**
 * Custom rate limiter with different limits per endpoint.
 * Uses Redis sliding window algorithm.
 *
 * The sliding window approach:
 * - Tracks requests in a sorted set with timestamps as scores
 * - Removes entries older than the window
 * - Counts remaining entries
 * - More accurate than fixed windows (no boundary burst issue)
 */
export function createRateLimiter(config: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyGenerator?: (req: FastifyRequest) => string;
  message?: string;
}) {
  return async function rateLimiter(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const redis = getRedis();

    const key = config.keyGenerator
      ? `${config.keyPrefix}:${config.keyGenerator(request)}`
      : `${config.keyPrefix}:${request.ip}`;

    const now = Date.now();
    const windowStart = now - config.windowMs;

    const pipeline = redis.pipeline();

    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current window entries
    pipeline.zcard(key);

    // Add current request
    pipeline.zadd(key, now, `${now}:${Math.random()}`);

    // Set expiry
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await pipeline.exec();
    const currentCount = results?.[1]?.[1] as number;

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', config.max);
    reply.header('X-RateLimit-Remaining', Math.max(0, config.max - currentCount - 1));
    reply.header('X-RateLimit-Reset', new Date(now + config.windowMs).toISOString());

    if (currentCount >= config.max) {
      return reply.status(429).send({
        error: {
          code: 'RATE_001',
          message: config.message || 'Rate limit exceeded. Please slow down.',
          retryAfter: Math.ceil(config.windowMs / 1000),
        },
      });
    }
  };
}

// ─── Pre-configured Rate Limiters ───────────────────────────────────────────

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyPrefix: 'rate:auth',
  message: 'Too many authentication attempts. Please try again later.',
});

export const voteRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyPrefix: 'rate:vote:min',
  keyGenerator: (req) => (req as any).userId || req.ip,
  message: 'Voting too fast. Please slow down.',
});

export const generationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  keyPrefix: 'rate:gen:min',
  keyGenerator: (req) => (req as any).userId || req.ip,
  message: 'Too many generation requests. Please wait a moment.',
});

export const reportRateLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  max: 10,
  keyPrefix: 'rate:report',
  keyGenerator: (req) => (req as any).userId || req.ip,
});
