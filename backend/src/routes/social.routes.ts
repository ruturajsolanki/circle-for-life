import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { SocialService } from '../services/social.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const markReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function socialRoutes(app: FastifyInstance) {
  // POST /users/:userId/follow
  app.post('/users/:userId/follow', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const followerId = (request as any).userId;
      const { userId } = request.params as { userId: string };
      const result = await SocialService.follow(
        new Types.ObjectId(followerId),
        new Types.ObjectId(userId)
      );
      return reply.send(result);
    },
  });

  // DELETE /users/:userId/follow
  app.delete('/users/:userId/follow', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const followerId = (request as any).userId;
      const { userId } = request.params as { userId: string };
      const result = await SocialService.unfollow(
        new Types.ObjectId(followerId),
        new Types.ObjectId(userId)
      );
      return reply.send(result);
    },
  });

  // GET /notifications
  app.get('/notifications', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { limit, cursor, unreadOnly } = request.query as {
        limit?: number;
        cursor?: string;
        unreadOnly?: boolean;
      };
      const result = await SocialService.getNotifications(
        new Types.ObjectId(userId),
        { limit, cursor, unreadOnly }
      );
      return reply.send(result);
    },
  });

  // POST /notifications/read
  app.post('/notifications/read', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const body = markReadSchema.parse(request.body);
      const result = await SocialService.markNotificationsRead(
        new Types.ObjectId(userId),
        body.notificationIds
      );
      return reply.send(result);
    },
  });
}
