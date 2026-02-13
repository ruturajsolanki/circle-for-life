/**
 * Circle for Life — Auth Routes
 *
 * Register, login, refresh — works with both CSV and Supabase backends.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { usersDB, logAudit, type LocalUser, type UserRole } from '../db/index.js';
import { calculateLevel } from '../services/levels.service.js';

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).optional(),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function localAuthRoutes(app: FastifyInstance) {

  // ─── Register ─────────────────────────────────────────────────────────
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

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
      role: 'user',
      permissions: '[]',
      tier: 'free',
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
      notes: '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };

    // Handle referral
    if (body.referralCode) {
      const referrer = await usersDB.findOne({ referralCode: body.referralCode } as any);
      if (referrer) {
        user.referredBy = referrer.id;
        await usersDB.increment(referrer.id, 'referralCount', 1);
        await usersDB.increment(referrer.id, 'gemBalance', 10);
        await usersDB.increment(referrer.id, 'totalGemsEarned', 10);
      }
    }

    await usersDB.create(user);

    const accessToken = app.jwt.sign(
      { userId: user.id, role: user.role, tier: user.tier },
      { expiresIn: '24h' }
    );
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: '30d' }
    );

    const { passwordHash, ...safeUser } = user;
    const level = calculateLevel(Number(user.totalGemsEarned) || 0);
    return reply.status(201).send({
      user: safeUser,
      level,
      tokens: { accessToken, refreshToken },
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await usersDB.findOne({ email: body.email } as any);
    if (!user) {
      return reply.status(401).send({
        error: { code: 'AUTH_001', message: 'Invalid credentials' },
      });
    }

    if (user.status === 'suspended' || user.bannedAt) {
      return reply.status(403).send({
        error: { code: 'AUTH_003', message: `Account suspended${user.banReason ? ': ' + user.banReason : ''}` },
      });
    }

    const isValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({
        error: { code: 'AUTH_001', message: 'Invalid credentials' },
      });
    }

    // Update last login
    await usersDB.updateById(user.id, {
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    // Daily login streak
    const today = new Date().toISOString().split('T')[0];
    if (user.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = 1;
      if (user.lastActiveDate === yesterdayStr) {
        newStreak = (Number(user.currentStreak) || 0) + 1;
      }

      // Daily login gems
      let gemsToAdd = 5;
      if (newStreak >= 30) gemsToAdd += 25;
      else if (newStreak >= 14) gemsToAdd += 10;
      else if (newStreak >= 7) gemsToAdd += 5;
      else if (newStreak >= 3) gemsToAdd += 2;

      await usersDB.updateById(user.id, {
        lastActiveDate: today,
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, Number(user.longestStreak) || 0),
        gemBalance: (Number(user.gemBalance) || 0) + gemsToAdd,
        totalGemsEarned: (Number(user.totalGemsEarned) || 0) + gemsToAdd,
      } as any);
    }

    const accessToken = app.jwt.sign(
      { userId: user.id, role: user.role, tier: user.tier },
      { expiresIn: '24h' }
    );
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: '30d' }
    );

    const { passwordHash, ...safeUser } = user;

    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      ipAddress: request.ip,
    });

    const updatedUser = await usersDB.findById(user.id) || user;
    const level = calculateLevel(Number(updatedUser.totalGemsEarned) || 0);
    return reply.send({
      user: safeUser,
      level,
      tokens: { accessToken, refreshToken },
    });
  });

  // ─── Refresh ──────────────────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      const decoded = app.jwt.verify<{ userId: string; type: string }>(refreshToken);
      if (decoded.type !== 'refresh') throw new Error('Invalid token type');

      const user = await usersDB.findById(decoded.userId);
      if (!user) throw new Error('User not found');

      const newAccess = app.jwt.sign(
        { userId: user.id, role: user.role, tier: user.tier },
        { expiresIn: '24h' }
      );
      const newRefresh = app.jwt.sign(
        { userId: user.id, type: 'refresh' },
        { expiresIn: '30d' }
      );

      return reply.send({ accessToken: newAccess, refreshToken: newRefresh });
    } catch {
      return reply.status(401).send({
        error: { code: 'AUTH_002', message: 'Invalid refresh token' },
      });
    }
  });

  // ─── Me (current user profile) ────────────────────────────────────────
  app.get('/me', async (request, reply) => {
    try {
      const decoded = await request.jwtVerify<{ userId: string }>();
      const user = await usersDB.findById(decoded.userId);
      if (!user) {
        return reply.status(401).send({
          error: { code: 'AUTH_002', message: 'User not found' },
        });
      }

      const { passwordHash, ...safeUser } = user;
      const level = calculateLevel(Number(user.totalGemsEarned) || 0);
      return reply.send({ user: safeUser, level });
    } catch {
      return reply.status(401).send({
        error: { code: 'AUTH_002', message: 'Not authenticated' },
      });
    }
  });

  // ─── Update Profile (self) ─────────────────────────────────────────────
  app.put('/profile', async (request, reply) => {
    try {
      const decoded = await request.jwtVerify<{ userId: string }>();
      const user = await usersDB.findById(decoded.userId);
      if (!user) {
        return reply.status(401).send({ error: { message: 'User not found' } });
      }

      const body = request.body as any;
      const updates: any = { updatedAt: new Date().toISOString() };

      // Only allow safe fields
      if (body.displayName && typeof body.displayName === 'string' && body.displayName.length <= 50) {
        updates.displayName = body.displayName.trim();
      }
      if (body.bio !== undefined && typeof body.bio === 'string' && body.bio.length <= 300) {
        updates.bio = body.bio.trim();
      }
      if (body.avatarUrl !== undefined && typeof body.avatarUrl === 'string' && body.avatarUrl.length <= 500) {
        updates.avatarUrl = body.avatarUrl.trim();
      }
      if (body.location !== undefined && typeof body.location === 'string' && body.location.length <= 100) {
        updates.location = body.location.trim();
      }
      if (body.website !== undefined && typeof body.website === 'string' && body.website.length <= 200) {
        updates.website = body.website.trim();
      }

      await usersDB.updateById(decoded.userId, updates);
      const updated = await usersDB.findById(decoded.userId);
      const { passwordHash, ...safeUser } = updated as any;
      const level = calculateLevel(Number(updated?.totalGemsEarned) || 0);

      return reply.send({ user: safeUser, level });
    } catch {
      return reply.status(401).send({ error: { message: 'Not authenticated' } });
    }
  });

  // ─── Logout ───────────────────────────────────────────────────────────
  app.post('/logout', async (_request, reply) => {
    return reply.status(204).send();
  });
}
