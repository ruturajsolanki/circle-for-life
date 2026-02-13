import { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../models/User.model.js';
import { getRedis } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ─── JWT Authentication Middleware ──────────────────────────────────────────

/**
 * Verifies JWT token and attaches user to request.
 * Checks for banned/deleted accounts.
 * Updates last-seen timestamp.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Verify JWT
    const decoded = await request.jwtVerify<{
      userId: string;
      tier: string;
      iat: number;
      exp: number;
    }>();

    // Check user exists and is not banned
    const redis = getRedis();
    const cachedUser = await redis.get(`session:${decoded.userId}`);

    if (cachedUser) {
      const userData = JSON.parse(cachedUser);
      if (userData.bannedAt) {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: 'Account suspended' },
        });
      }
      (request as any).userId = decoded.userId;
      (request as any).userTier = userData.tier;
      return;
    }

    // Cache miss — check DB
    const user = await User.findById(decoded.userId)
      .select('tier bannedAt deletedAt shadowBanned')
      .lean();

    if (!user) {
      return reply.status(401).send({
        error: { code: 'AUTH_002', message: 'Invalid token' },
      });
    }

    if (user.bannedAt) {
      return reply.status(403).send({
        error: { code: 'AUTH_003', message: 'Account suspended' },
      });
    }

    if (user.deletedAt) {
      return reply.status(403).send({
        error: { code: 'AUTH_003', message: 'Account deleted' },
      });
    }

    // Cache session data
    await redis.set(
      `session:${decoded.userId}`,
      JSON.stringify({
        tier: user.tier,
        bannedAt: user.bannedAt,
        shadowBanned: user.shadowBanned,
      }),
      'EX',
      300 // 5 minutes
    );

    (request as any).userId = decoded.userId;
    (request as any).userTier = user.tier;
  } catch (error) {
    return reply.status(401).send({
      error: { code: 'AUTH_002', message: 'Token expired or invalid' },
    });
  }
}

/**
 * Optional authentication — attaches user if token present, otherwise continues.
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      (request as any).userId = null;
      return;
    }
    await authenticate(request, reply);
  } catch {
    (request as any).userId = null;
  }
}

/**
 * Admin-only middleware.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authenticate(request, reply);

  const userId = (request as any).userId;
  if (!userId) return;

  const user = await User.findById(userId).select('featureFlags').lean();
  if (!user?.featureFlags?.isAdmin) {
    return reply.status(403).send({
      error: { code: 'AUTH_003', message: 'Admin access required' },
    });
  }
}
