/**
 * Circle for Life — Role-Based Access Control Middleware
 *
 * Works with both local CSV and Supabase databases via the unified DB layer.
 * Checks user role and permissions before allowing access to protected routes.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  usersDB,
  hasPermission,
  outranks,
  Permission,
  UserRole,
  ROLE_HIERARCHY,
} from '../db/index.js';
import { logger } from '../utils/logger.js';

/**
 * Authenticate user via JWT.
 * Attaches userId, userRole, userPermissions to request.
 */
export async function localAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = await request.jwtVerify<{
      userId: string;
      role: string;
      tier: string;
    }>();

    const user = await usersDB.findById(decoded.userId);

    if (!user) {
      return reply.status(401).send({
        error: { code: 'AUTH_002', message: 'User not found' },
      });
    }

    if (user.status === 'suspended' || user.bannedAt) {
      return reply.status(403).send({
        error: { code: 'AUTH_003', message: 'Account suspended' },
      });
    }

    if (user.status === 'deleted') {
      return reply.status(403).send({
        error: { code: 'AUTH_003', message: 'Account deleted' },
      });
    }

    (request as any).userId = user.id;
    (request as any).userRole = user.role;
    (request as any).userTier = user.tier;
    (request as any).user = user;
  } catch (error) {
    return reply.status(401).send({
      error: { code: 'AUTH_002', message: 'Token expired or invalid' },
    });
  }
}

/**
 * Require specific permission(s). Must be used AFTER localAuthenticate.
 */
export function requirePermission(...requiredPermissions: Permission[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const role = (request as any).userRole as UserRole;
    const user = (request as any).user;

    if (!role) {
      return reply.status(403).send({
        error: { code: 'AUTH_003', message: 'Access denied' },
      });
    }

    let customPerms: Permission[] = [];
    if (user?.permissions) {
      try {
        customPerms = typeof user.permissions === 'string'
          ? JSON.parse(user.permissions)
          : user.permissions;
      } catch { /* ignore */ }
    }

    const hasAccess = requiredPermissions.some(
      (perm) => hasPermission(role, perm) || customPerms.includes(perm)
    );

    if (!hasAccess) {
      logger.warn(
        `Permission denied: user=${(request as any).userId} role=${role} needed=${requiredPermissions.join(',')}`
      );
      return reply.status(403).send({
        error: {
          code: 'AUTH_003',
          message: `Insufficient permissions. Required: ${requiredPermissions.join(' or ')}`,
        },
      });
    }
  };
}

/**
 * Require a minimum role level.
 */
export function requireRole(minimumRole: UserRole) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const role = (request as any).userRole as UserRole;

    if (!role || ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minimumRole]) {
      return reply.status(403).send({
        error: {
          code: 'AUTH_003',
          message: `Requires ${minimumRole} role or higher`,
        },
      });
    }
  };
}

/**
 * Optional auth — attaches user if token present.
 */
export async function localOptionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      (request as any).userId = null;
      (request as any).userRole = 'guest';
      return;
    }

    const decoded = await request.jwtVerify<{
      userId: string;
      role: string;
    }>();

    const user = await usersDB.findById(decoded.userId);
    if (user) {
      (request as any).userId = user.id;
      (request as any).userRole = user.role;
      (request as any).user = user;
    } else {
      (request as any).userId = null;
      (request as any).userRole = 'guest';
    }
  } catch {
    (request as any).userId = null;
    (request as any).userRole = 'guest';
  }
}
