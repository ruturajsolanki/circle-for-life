/**
 * Circle for Life — User Management Routes
 *
 * Full CRUD for user management with role-based access control.
 * Works with both CSV and Supabase via unified DB layer.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { localAuthenticate, requirePermission, requireRole } from '../middleware/rbac.middleware.js';
import {
  usersDB,
  auditLogDB,
  logAudit,
  hasPermission,
  outranks,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  type UserRole,
  type Permission,
  type LocalUser,
} from '../db/index.js';
import { LEVELS, calculateLevel } from '../services/levels.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const roles: UserRole[] = ['super_admin', 'admin', 'moderator', 'creator', 'user', 'guest'];

const createUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).optional(),
  role: z.enum(roles as [string, ...string[]]).optional().default('user'),
  tier: z.enum(['free', 'pro', 'premium']).optional().default('free'),
  notes: z.string().max(500).optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(160).optional(),
  email: z.string().email().optional(),
  tier: z.enum(['free', 'pro', 'premium']).optional(),
  status: z.enum(['active', 'suspended', 'deleted', 'pending_review']).optional(),
  notes: z.string().max(500).optional(),
  trustScore: z.number().min(0).max(100).optional(),
  emailVerified: z.boolean().optional(),
});

const assignRoleSchema = z.object({
  role: z.enum(roles as [string, ...string[]]),
  reason: z.string().max(500).optional(),
});

const banUserSchema = z.object({
  reason: z.string().min(1).max(500),
  duration: z.enum(['1h', '24h', '7d', '30d', 'permanent']).optional().default('permanent'),
});

const adjustGemsSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
});

const listUsersSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  role: z.enum(roles as [string, ...string[]]).optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ─── Helper: sanitize user for response ─────────────────────────────────────

function sanitizeUser(user: LocalUser, includePrivate = false): any {
  const safe: any = {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    tier: user.tier,
    gemBalance: user.gemBalance,
    totalGemsEarned: user.totalGemsEarned,
    totalGemsSpent: user.totalGemsSpent,
    totalPosts: user.totalPosts,
    totalVotesReceived: user.totalVotesReceived,
    totalVotesGiven: user.totalVotesGiven,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    referralCode: user.referralCode,
    referralCount: user.referralCount,
    trustScore: user.trustScore,
    emailVerified: user.emailVerified,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };

  if (includePrivate) {
    safe.shadowBanned = user.shadowBanned;
    safe.bannedAt = user.bannedAt;
    safe.banReason = user.banReason;
    safe.banExpiresAt = user.banExpiresAt;
    safe.reportCount = user.reportCount;
    safe.notes = user.notes;
    safe.permissions = user.permissions;
    safe.lastActiveDate = user.lastActiveDate;
  }

  return safe;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function userManagementRoutes(app: FastifyInstance) {

  // ─── LIST USERS ─────────────────────────────────────────────────────────
  app.get('/users', {
    preHandler: [localAuthenticate, requirePermission('users.list')],
    handler: async (request, reply) => {
      const query = listUsersSchema.parse(request.query);

      // If searching, do text search first
      if (query.search) {
        const byUsername = await usersDB.search('username', query.search);
        const byEmail = await usersDB.search('email', query.search);
        const byName = await usersDB.search('displayName', query.search);
        const merged = new Map<string, LocalUser>();
        [...byUsername, ...byEmail, ...byName].forEach((u: any) => merged.set(u.id, u));
        let results = Array.from(merged.values());

        if (query.role) results = results.filter((u: any) => u.role === query.role);
        if (query.status) results = results.filter((u: any) => u.status === query.status);

        const total = results.length;
        const start = (query.page - 1) * query.limit;
        const data = results.slice(start, start + query.limit);

        return reply.send({
          users: data.map((u: any) => sanitizeUser(u, true)),
          total,
          page: query.page,
          totalPages: Math.ceil(total / query.limit),
        });
      }

      // Standard paginated list
      const filter: any = {};
      if (query.role) filter.role = query.role;
      if (query.status) filter.status = query.status;

      const result = await usersDB.paginate({
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });

      return reply.send({
        users: result.data.map((u: any) => sanitizeUser(u, true)),
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      });
    },
  });

  // ─── GET USER BY ID ─────────────────────────────────────────────────────
  app.get('/users/:userId', {
    preHandler: [localAuthenticate, requirePermission('users.read')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const user = await usersDB.findById(userId);

      if (!user) {
        return reply.status(404).send({
          error: { code: 'USER_001', message: 'User not found' },
        });
      }

      return reply.send({ user: sanitizeUser(user, true) });
    },
  });

  // ─── CREATE USER ────────────────────────────────────────────────────────
  app.post('/users', {
    preHandler: [localAuthenticate, requirePermission('users.create')],
    handler: async (request, reply) => {
      const body = createUserSchema.parse(request.body);
      const actorRole = (request as any).userRole as UserRole;

      if (body.role && !outranks(actorRole, body.role as UserRole)) {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: `Cannot create user with role ${body.role} — you need a higher role` },
        });
      }

      if (await usersDB.findOne({ username: body.username } as any)) {
        return reply.status(409).send({
          error: { code: 'AUTH_001', message: 'Username already taken' },
        });
      }
      if (await usersDB.findOne({ email: body.email } as any)) {
        return reply.status(409).send({
          error: { code: 'AUTH_001', message: 'Email already taken' },
        });
      }

      const hash = await bcrypt.hash(body.password, 12);
      const now = new Date().toISOString();

      const user: LocalUser = {
        id: `usr_${nanoid(12)}`,
        username: body.username,
        email: body.email,
        passwordHash: hash,
        displayName: body.displayName || body.username,
        avatarUrl: '',
        bio: '',
        role: (body.role || 'user') as UserRole,
        permissions: '[]',
        tier: body.tier || 'free',
        gemBalance: 0,
        totalGemsEarned: 0,
        totalGemsSpent: 0,
        totalPosts: 0,
        totalVotesReceived: 0,
        totalVotesGiven: 0,
        followersCount: 0,
        followingCount: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: '',
        referralCode: nanoid(8).toUpperCase(),
        referredBy: '',
        referralCount: 0,
        trustScore: 50,
        shadowBanned: false,
        bannedAt: '',
        banReason: '',
        banExpiresAt: '',
        reportCount: 0,
        emailVerified: false,
        status: 'active',
        notes: body.notes || '',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: '',
      };

      await usersDB.create(user);

      await logAudit({
        actorId: (request as any).userId,
        actorRole,
        action: 'user.created',
        targetType: 'user',
        targetId: user.id,
        details: `Created user ${user.username} with role ${user.role}`,
        ipAddress: request.ip,
      });

      return reply.status(201).send({ user: sanitizeUser(user, true) });
    },
  });

  // ─── UPDATE USER ────────────────────────────────────────────────────────
  app.patch('/users/:userId', {
    preHandler: [localAuthenticate, requirePermission('users.update')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = updateUserSchema.parse(request.body);
      const actorRole = (request as any).userRole as UserRole;

      const user = await usersDB.findById(userId);
      if (!user) {
        return reply.status(404).send({
          error: { code: 'USER_001', message: 'User not found' },
        });
      }

      if (actorRole !== 'super_admin' && !outranks(actorRole, user.role as UserRole)) {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: 'Cannot modify a user with equal or higher role' },
        });
      }

      if (body.email && body.email !== user.email) {
        if (await usersDB.findOne({ email: body.email } as any)) {
          return reply.status(409).send({
            error: { code: 'AUTH_001', message: 'Email already taken' },
          });
        }
      }

      const updates: any = { ...body, updatedAt: new Date().toISOString() };
      const updated = await usersDB.updateById(userId, updates);

      await logAudit({
        actorId: (request as any).userId,
        actorRole,
        action: 'user.updated',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify(body),
        ipAddress: request.ip,
      });

      return reply.send({ user: sanitizeUser(updated!, true) });
    },
  });

  // ─── ASSIGN ROLE ────────────────────────────────────────────────────────
  app.post('/users/:userId/role', {
    preHandler: [localAuthenticate, requirePermission('users.assign_role')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = assignRoleSchema.parse(request.body);
      const actorRole = (request as any).userRole as UserRole;
      const actorId = (request as any).userId;

      const user = await usersDB.findById(userId);
      if (!user) {
        return reply.status(404).send({
          error: { code: 'USER_001', message: 'User not found' },
        });
      }

      if (!outranks(actorRole, body.role as UserRole)) {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: `Cannot assign role ${body.role} — you need a higher role` },
        });
      }

      if (!outranks(actorRole, user.role as UserRole) && actorRole !== 'super_admin') {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: 'Cannot change role of user with equal or higher rank' },
        });
      }

      if (userId === actorId) {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: 'Cannot change your own role' },
        });
      }

      const previousRole = user.role;
      await usersDB.updateById(userId, {
        role: body.role as UserRole,
        updatedAt: new Date().toISOString(),
      } as any);

      await logAudit({
        actorId,
        actorRole,
        action: 'user.role_changed',
        targetType: 'user',
        targetId: userId,
        details: `${previousRole} → ${body.role}${body.reason ? ` | Reason: ${body.reason}` : ''}`,
        ipAddress: request.ip,
      });

      const updated = await usersDB.findById(userId);
      return reply.send({
        user: sanitizeUser(updated!, true),
        previousRole,
        newRole: body.role,
      });
    },
  });

  // ─── BAN USER ───────────────────────────────────────────────────────────
  app.post('/users/:userId/ban', {
    preHandler: [localAuthenticate, requirePermission('users.ban')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = banUserSchema.parse(request.body);
      const actorRole = (request as any).userRole as UserRole;

      const user = await usersDB.findById(userId);
      if (!user) {
        return reply.status(404).send({
          error: { code: 'USER_001', message: 'User not found' },
        });
      }

      if (!outranks(actorRole, user.role as UserRole)) {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: 'Cannot ban a user with equal or higher role' },
        });
      }

      const now = new Date();
      let expiresAt = '';
      if (body.duration !== 'permanent') {
        const durations: Record<string, number> = {
          '1h': 3600000,
          '24h': 86400000,
          '7d': 604800000,
          '30d': 2592000000,
        };
        expiresAt = new Date(now.getTime() + durations[body.duration]).toISOString();
      }

      await usersDB.updateById(userId, {
        bannedAt: now.toISOString(),
        banReason: body.reason,
        banExpiresAt: expiresAt,
        status: 'suspended',
        updatedAt: now.toISOString(),
      } as any);

      await logAudit({
        actorId: (request as any).userId,
        actorRole,
        action: 'user.banned',
        targetType: 'user',
        targetId: userId,
        details: `Duration: ${body.duration} | Reason: ${body.reason}`,
        ipAddress: request.ip,
      });

      return reply.send({ success: true, bannedUntil: expiresAt || 'permanent' });
    },
  });

  // ─── UNBAN USER ─────────────────────────────────────────────────────────
  app.delete('/users/:userId/ban', {
    preHandler: [localAuthenticate, requirePermission('users.ban')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };

      const user = await usersDB.findById(userId);
      if (!user) {
        return reply.status(404).send({
          error: { code: 'USER_001', message: 'User not found' },
        });
      }

      await usersDB.updateById(userId, {
        bannedAt: '',
        banReason: '',
        banExpiresAt: '',
        status: 'active',
        updatedAt: new Date().toISOString(),
      } as any);

      await logAudit({
        actorId: (request as any).userId,
        actorRole: (request as any).userRole,
        action: 'user.unbanned',
        targetType: 'user',
        targetId: userId,
        ipAddress: request.ip,
      });

      return reply.send({ success: true });
    },
  });

  // ─── SHADOW BAN ─────────────────────────────────────────────────────────
  app.post('/users/:userId/shadow-ban', {
    preHandler: [localAuthenticate, requirePermission('users.shadow_ban')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const user = await usersDB.findById(userId);
      if (!user) {
        return reply.status(404).send({
          error: { code: 'USER_001', message: 'User not found' },
        });
      }

      const isShadowed = user.shadowBanned === true || String(user.shadowBanned) === 'true';
      const newValue = !isShadowed;

      await usersDB.updateById(userId, {
        shadowBanned: newValue,
        updatedAt: new Date().toISOString(),
      } as any);

      await logAudit({
        actorId: (request as any).userId,
        actorRole: (request as any).userRole,
        action: isShadowed ? 'user.shadow_ban_removed' : 'user.shadow_banned',
        targetType: 'user',
        targetId: userId,
        ipAddress: request.ip,
      });

      return reply.send({
        success: true,
        shadowBanned: newValue,
      });
    },
  });

  // ─── ADJUST GEMS ────────────────────────────────────────────────────────
  app.post('/users/:userId/gems', {
    preHandler: [localAuthenticate, requirePermission('users.manage_gems')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = adjustGemsSchema.parse(request.body);

      const user = await usersDB.findById(userId);
      if (!user) {
        return reply.status(404).send({
          error: { code: 'USER_001', message: 'User not found' },
        });
      }

      const newBalance = Math.max(0, (Number(user.gemBalance) || 0) + body.amount);

      await usersDB.updateById(userId, {
        gemBalance: newBalance,
        totalGemsEarned: body.amount > 0 ? (Number(user.totalGemsEarned) || 0) + body.amount : Number(user.totalGemsEarned) || 0,
        totalGemsSpent: body.amount < 0 ? (Number(user.totalGemsSpent) || 0) + Math.abs(body.amount) : Number(user.totalGemsSpent) || 0,
        updatedAt: new Date().toISOString(),
      } as any);

      await logAudit({
        actorId: (request as any).userId,
        actorRole: (request as any).userRole,
        action: 'user.gems_adjusted',
        targetType: 'user',
        targetId: userId,
        details: `${body.amount > 0 ? '+' : ''}${body.amount} gems | Reason: ${body.reason} | New balance: ${newBalance}`,
        ipAddress: request.ip,
      });

      return reply.send({
        previousBalance: Number(user.gemBalance) || 0,
        adjustment: body.amount,
        newBalance,
      });
    },
  });

  // ─── DELETE USER ────────────────────────────────────────────────────────
  app.delete('/users/:userId', {
    preHandler: [localAuthenticate, requirePermission('users.delete')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const actorRole = (request as any).userRole as UserRole;

      const user = await usersDB.findById(userId);
      if (!user) {
        return reply.status(404).send({
          error: { code: 'USER_001', message: 'User not found' },
        });
      }

      if (!outranks(actorRole, user.role as UserRole)) {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: 'Cannot delete a user with equal or higher role' },
        });
      }

      await usersDB.updateById(userId, {
        status: 'deleted',
        updatedAt: new Date().toISOString(),
      } as any);

      await logAudit({
        actorId: (request as any).userId,
        actorRole,
        action: 'user.deleted',
        targetType: 'user',
        targetId: userId,
        details: `Soft-deleted user ${user.username}`,
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    },
  });

  // ─── RESET PASSWORD ────────────────────────────────────────────────────
  app.post('/users/:userId/reset-password', {
    preHandler: [localAuthenticate, requirePermission('users.update')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = z.object({ newPassword: z.string().min(8).max(128) }).parse(request.body);
      const actorRole = (request as any).userRole as UserRole;

      const user = await usersDB.findById(userId);
      if (!user) return reply.status(404).send({ error: { code: 'USER_001', message: 'User not found' } });
      if (actorRole !== 'super_admin' && !outranks(actorRole, user.role as UserRole)) {
        return reply.status(403).send({ error: { code: 'AUTH_003', message: 'Cannot reset password for this user' } });
      }

      const hash = await bcrypt.hash(body.newPassword, 12);
      await usersDB.updateById(userId, { passwordHash: hash, updatedAt: new Date().toISOString() } as any);

      await logAudit({
        actorId: (request as any).userId, actorRole,
        action: 'user.password_reset', targetType: 'user', targetId: userId,
        ipAddress: request.ip,
      });

      return reply.send({ success: true, message: 'Password reset successfully' });
    },
  });

  // ─── SET LEVEL ──────────────────────────────────────────────────────────
  app.post('/users/:userId/set-level', {
    preHandler: [localAuthenticate, requirePermission('users.manage_gems')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = z.object({ level: z.number().int().min(1).max(10), reason: z.string().optional() }).parse(request.body);

      const user = await usersDB.findById(userId);
      if (!user) return reply.status(404).send({ error: { code: 'USER_001', message: 'User not found' } });

      const targetLevel = LEVELS.find(l => l.level === body.level);
      if (!targetLevel) return reply.status(400).send({ error: { message: 'Invalid level' } });

      const currentGems = Number(user.totalGemsEarned) || 0;
      const neededGems = targetLevel.minGems;
      const adjustment = neededGems - currentGems;

      await usersDB.updateById(userId, {
        gemBalance: Math.max(0, (Number(user.gemBalance) || 0) + adjustment),
        totalGemsEarned: neededGems,
        ...(adjustment < 0 ? { totalGemsSpent: (Number(user.totalGemsSpent) || 0) + Math.abs(adjustment) } : {}),
        updatedAt: new Date().toISOString(),
      } as any);

      await logAudit({
        actorId: (request as any).userId, actorRole: (request as any).userRole,
        action: 'user.level_set', targetType: 'user', targetId: userId,
        details: `Set to Level ${body.level} (${targetLevel.title}). Gems: ${currentGems} → ${neededGems}. ${body.reason || ''}`,
        ipAddress: request.ip,
      });

      const updatedUser = await usersDB.findById(userId);
      return reply.send({
        success: true,
        level: calculateLevel(Number(updatedUser?.totalGemsEarned) || 0),
        previousGems: currentGems,
        newGems: neededGems,
      });
    },
  });

  // ─── CHANGE TIER ──────────────────────────────────────────────────────
  app.post('/users/:userId/tier', {
    preHandler: [localAuthenticate, requirePermission('users.update')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = z.object({
        tier: z.enum(['free', 'pro', 'premium']),
        reason: z.string().optional(),
      }).parse(request.body);

      const user = await usersDB.findById(userId);
      if (!user) return reply.status(404).send({ error: { code: 'USER_001', message: 'User not found' } });

      const previousTier = user.tier;
      await usersDB.updateById(userId, { tier: body.tier, updatedAt: new Date().toISOString() } as any);

      await logAudit({
        actorId: (request as any).userId, actorRole: (request as any).userRole,
        action: 'user.tier_changed', targetType: 'user', targetId: userId,
        details: `${previousTier} → ${body.tier}${body.reason ? ' | ' + body.reason : ''}`,
        ipAddress: request.ip,
      });

      return reply.send({ success: true, previousTier, newTier: body.tier });
    },
  });

  // ─── VERIFY / UNVERIFY EMAIL ──────────────────────────────────────────
  app.post('/users/:userId/verify-email', {
    preHandler: [localAuthenticate, requirePermission('users.update')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };

      const user = await usersDB.findById(userId);
      if (!user) return reply.status(404).send({ error: { code: 'USER_001', message: 'User not found' } });

      const isVerified = user.emailVerified === true || String(user.emailVerified) === 'true';
      await usersDB.updateById(userId, { emailVerified: !isVerified, updatedAt: new Date().toISOString() } as any);

      await logAudit({
        actorId: (request as any).userId, actorRole: (request as any).userRole,
        action: isVerified ? 'user.email_unverified' : 'user.email_verified',
        targetType: 'user', targetId: userId, ipAddress: request.ip,
      });

      return reply.send({ success: true, emailVerified: !isVerified });
    },
  });

  // ─── RESET STREAK ─────────────────────────────────────────────────────
  app.post('/users/:userId/reset-streak', {
    preHandler: [localAuthenticate, requirePermission('users.update')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };

      const user = await usersDB.findById(userId);
      if (!user) return reply.status(404).send({ error: { code: 'USER_001', message: 'User not found' } });

      const prev = Number(user.currentStreak) || 0;
      await usersDB.updateById(userId, { currentStreak: 0, lastActiveDate: '', updatedAt: new Date().toISOString() } as any);

      await logAudit({
        actorId: (request as any).userId, actorRole: (request as any).userRole,
        action: 'user.streak_reset', targetType: 'user', targetId: userId,
        details: `Streak reset: ${prev} → 0`,
        ipAddress: request.ip,
      });

      return reply.send({ success: true, previousStreak: prev });
    },
  });

  // ─── SET TRUST SCORE ──────────────────────────────────────────────────
  app.post('/users/:userId/trust-score', {
    preHandler: [localAuthenticate, requirePermission('users.update')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = z.object({ score: z.number().int().min(0).max(100), reason: z.string().optional() }).parse(request.body);

      const user = await usersDB.findById(userId);
      if (!user) return reply.status(404).send({ error: { code: 'USER_001', message: 'User not found' } });

      const prev = Number(user.trustScore) || 0;
      await usersDB.updateById(userId, { trustScore: body.score, updatedAt: new Date().toISOString() } as any);

      await logAudit({
        actorId: (request as any).userId, actorRole: (request as any).userRole,
        action: 'user.trust_score_changed', targetType: 'user', targetId: userId,
        details: `${prev} → ${body.score}${body.reason ? ' | ' + body.reason : ''}`,
        ipAddress: request.ip,
      });

      return reply.send({ success: true, previousScore: prev, newScore: body.score });
    },
  });

  // ─── SET STATUS ───────────────────────────────────────────────────────
  app.post('/users/:userId/status', {
    preHandler: [localAuthenticate, requirePermission('users.update')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = z.object({
        status: z.enum(['active', 'suspended', 'deleted', 'pending_review']),
        reason: z.string().optional(),
      }).parse(request.body);

      const user = await usersDB.findById(userId);
      if (!user) return reply.status(404).send({ error: { code: 'USER_001', message: 'User not found' } });

      const prev = user.status;
      await usersDB.updateById(userId, { status: body.status, updatedAt: new Date().toISOString() } as any);

      await logAudit({
        actorId: (request as any).userId, actorRole: (request as any).userRole,
        action: 'user.status_changed', targetType: 'user', targetId: userId,
        details: `${prev} → ${body.status}${body.reason ? ' | ' + body.reason : ''}`,
        ipAddress: request.ip,
      });

      return reply.send({ success: true, previousStatus: prev, newStatus: body.status });
    },
  });

  // ─── UPDATE NOTES ─────────────────────────────────────────────────────
  app.post('/users/:userId/notes', {
    preHandler: [localAuthenticate, requirePermission('users.update')],
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = z.object({ notes: z.string().max(2000) }).parse(request.body);

      const user = await usersDB.findById(userId);
      if (!user) return reply.status(404).send({ error: { code: 'USER_001', message: 'User not found' } });

      await usersDB.updateById(userId, { notes: body.notes, updatedAt: new Date().toISOString() } as any);

      await logAudit({
        actorId: (request as any).userId, actorRole: (request as any).userRole,
        action: 'user.notes_updated', targetType: 'user', targetId: userId,
        ipAddress: request.ip,
      });

      return reply.send({ success: true });
    },
  });

  // ─── GET LEVELS REFERENCE ─────────────────────────────────────────────
  app.get('/levels', {
    preHandler: [localAuthenticate],
    handler: async (_request, reply) => {
      return reply.send({ levels: LEVELS });
    },
  });

  // ─── GET ROLES & PERMISSIONS REFERENCE ──────────────────────────────────
  app.get('/roles', {
    preHandler: [localAuthenticate],
    handler: async (_request, reply) => {
      return reply.send({
        roles: Object.entries(ROLE_HIERARCHY).map(([role, level]) => ({
          role,
          level,
          permissions: ROLE_PERMISSIONS[role as UserRole],
        })),
      });
    },
  });

  // ─── AUDIT LOG ──────────────────────────────────────────────────────────
  app.get('/audit-log', {
    preHandler: [localAuthenticate, requireRole('admin')],
    handler: async (request, reply) => {
      const { page = 1, limit = 50 } = request.query as { page?: number; limit?: number };

      const result = await auditLogDB.paginate({
        page: Number(page),
        limit: Number(limit),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      return reply.send({
        entries: result.data,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      });
    },
  });

  // ─── STATS OVERVIEW ────────────────────────────────────────────────────
  app.get('/stats', {
    preHandler: [localAuthenticate, requirePermission('analytics.view')],
    handler: async (_request, reply) => {
      const allUsers = await usersDB.findAll();

      const roleCounts: Record<string, number> = {};
      const tierCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};
      let totalGems = 0;
      let bannedCount = 0;
      let shadowBannedCount = 0;

      for (const u of allUsers) {
        roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
        tierCounts[u.tier] = (tierCounts[u.tier] || 0) + 1;
        statusCounts[u.status] = (statusCounts[u.status] || 0) + 1;
        totalGems += Number(u.gemBalance) || 0;
        if (u.bannedAt) bannedCount++;
        if (u.shadowBanned) shadowBannedCount++;
      }

      return reply.send({
        totalUsers: allUsers.length,
        roleCounts,
        tierCounts,
        statusCounts,
        totalGemsInCirculation: totalGems,
        bannedCount,
        shadowBannedCount,
      });
    },
  });
}
