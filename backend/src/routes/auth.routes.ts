import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { User } from '../models/User.model.js';
import { GemService } from '../services/gem.service.js';
import { authRateLimiter } from '../middleware/rateLimit.middleware.js';
import { nanoid } from 'nanoid';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  deviceId: z.string(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/register', {
    preHandler: [authRateLimiter],
    handler: async (request, reply) => {
      const body = registerSchema.parse(request.body);

      // Check uniqueness
      const existingUser = await User.findOne({
        $or: [{ email: body.email }, { username: body.username }],
      });

      if (existingUser) {
        const field = existingUser.email === body.email ? 'email' : 'username';
        return reply.status(409).send({
          error: { code: 'AUTH_001', message: `${field} already taken` },
        });
      }

      // Create user
      const user = await User.create({
        username: body.username,
        email: body.email,
        passwordHash: body.password, // Pre-save hook will hash it
        displayName: body.username,
        referralCode: nanoid(8),
      });

      // Process referral
      if (body.referralCode) {
        const referrer = await User.findOne({
          referralCode: body.referralCode,
        });
        if (referrer) {
          await User.updateOne(
            { _id: user._id },
            { $set: { referredBy: referrer._id } }
          );
          // Award referral bonus (async)
          GemService.processReferralBonus(referrer._id, user._id).catch(
            () => {}
          );
        }
      }

      // Generate tokens
      const accessToken = app.jwt.sign(
        { userId: user._id.toString(), tier: user.tier },
        { expiresIn: '15m' }
      );
      const refreshToken = app.jwt.sign(
        { userId: user._id.toString(), type: 'refresh' },
        { expiresIn: '7d' }
      );

      return reply.status(201).send({
        user: user.toJSON(),
        tokens: { accessToken, refreshToken },
      });
    },
  });

  // Login
  app.post('/login', {
    preHandler: [authRateLimiter],
    handler: async (request, reply) => {
      const body = loginSchema.parse(request.body);

      const user = await User.findOne({ email: body.email }).select(
        '+passwordHash'
      );

      if (!user) {
        return reply.status(401).send({
          error: { code: 'AUTH_001', message: 'Invalid credentials' },
        });
      }

      if (user.bannedAt) {
        return reply.status(403).send({
          error: { code: 'AUTH_003', message: 'Account suspended' },
        });
      }

      const isValid = await user.comparePassword(body.password);
      if (!isValid) {
        return reply.status(401).send({
          error: { code: 'AUTH_001', message: 'Invalid credentials' },
        });
      }

      // Update device info
      const deviceIndex = user.devices.findIndex(
        (d) => d.deviceId === body.deviceId
      );
      if (deviceIndex >= 0) {
        user.devices[deviceIndex].lastSeenAt = new Date();
      } else {
        user.devices.push({
          deviceId: body.deviceId,
          platform: 'ios', // Would come from request
          lastSeenAt: new Date(),
        });
      }

      user.lastLoginAt = new Date();
      await user.save();

      // Process daily login
      const loginBonus = await GemService.processDailyLogin(user._id);

      const accessToken = app.jwt.sign(
        { userId: user._id.toString(), tier: user.tier },
        { expiresIn: '15m' }
      );
      const refreshToken = app.jwt.sign(
        { userId: user._id.toString(), type: 'refresh' },
        { expiresIn: '7d' }
      );

      return reply.send({
        user: user.toJSON(),
        tokens: { accessToken, refreshToken },
        loginBonus,
      });
    },
  });

  // Refresh Token
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      const decoded = app.jwt.verify<{
        userId: string;
        type: string;
      }>(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await User.findById(decoded.userId).select('tier');
      if (!user) throw new Error('User not found');

      const newAccessToken = app.jwt.sign(
        { userId: user._id.toString(), tier: user.tier },
        { expiresIn: '15m' }
      );
      const newRefreshToken = app.jwt.sign(
        { userId: user._id.toString(), type: 'refresh' },
        { expiresIn: '7d' }
      );

      return reply.send({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch {
      return reply.status(401).send({
        error: { code: 'AUTH_002', message: 'Invalid refresh token' },
      });
    }
  });

  // Logout
  app.post('/logout', async (request, reply) => {
    // In production: blacklist the refresh token in Redis
    return reply.status(204).send();
  });
}
