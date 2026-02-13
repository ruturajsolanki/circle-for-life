import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth.middleware.js';
import { FeedService } from '../services/feed.service.js';

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function feedRoutes(app: FastifyInstance) {
  // GET /trending
  app.get('/trending', {
    handler: async (request, reply) => {
      const { cursor, limit, timeWindow } = request.query as {
        cursor?: string;
        limit?: number;
        timeWindow?: '24h' | '7d' | '30d';
      };
      const result = await FeedService.getTrending({ cursor, limit, timeWindow });
      return reply.send(result);
    },
  });

  // GET /new
  app.get('/new', {
    handler: async (request, reply) => {
      const { cursor, limit } = request.query as { cursor?: string; limit?: number };
      const result = await FeedService.getNew({ cursor, limit });
      return reply.send(result);
    },
  });

  // GET /following — Requires auth
  app.get('/following', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { cursor, limit } = request.query as { cursor?: string; limit?: number };
      const result = await FeedService.getFollowing({
        userId: new Types.ObjectId(userId),
        cursor,
        limit,
      });
      return reply.send(result);
    },
  });

  // GET /personalized — Requires auth
  app.get('/personalized', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { cursor, limit } = request.query as { cursor?: string; limit?: number };
      const result = await FeedService.getPersonalized({
        userId: new Types.ObjectId(userId),
        cursor,
        limit,
      });
      return reply.send(result);
    },
  });

  // GET /category/:category
  app.get('/category/:category', {
    handler: async (request, reply) => {
      const { category } = request.params as { category: string };
      const { cursor, limit } = request.query as { cursor?: string; limit?: number };
      const result = await FeedService.getCategory({ category, cursor, limit });
      return reply.send(result);
    },
  });
}
