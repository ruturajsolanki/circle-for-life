import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { UserService } from '../services/user.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(160).optional(),
  avatarUrl: z.string().url().optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function userRoutes(app: FastifyInstance) {
  // GET /me — Current user profile
  app.get('/me', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const user = await UserService.getMe(new Types.ObjectId(userId));
      return reply.send(user);
    },
  });

  // PATCH /me — Update current user
  app.patch('/me', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const body = updateMeSchema.parse(request.body || {});
      const user = await UserService.updateMe(
        new Types.ObjectId(userId),
        body
      );
      return reply.send(user);
    },
  });

  // GET /me/streak — Current user streak
  app.get('/me/streak', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const streak = await UserService.getStreak(new Types.ObjectId(userId));
      return reply.send(streak);
    },
  });

  // POST /me/daily-checkin
  app.post('/me/daily-checkin', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const result = await UserService.dailyCheckin(new Types.ObjectId(userId));
      return reply.send(result);
    },
  });

  // GET /:userId — Public user profile
  app.get('/:userId', {
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const user = await UserService.getById(new Types.ObjectId(userId));
      return reply.send(user);
    },
  });

  // GET /:userId/posts — User's posts
  app.get('/:userId/posts', {
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const { cursor, limit } = request.query as { cursor?: string; limit?: number };
      const result = await UserService.getPosts({
        userId: new Types.ObjectId(userId),
        cursor,
        limit,
      });
      return reply.send(result);
    },
  });
}
