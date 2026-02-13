import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { GemService } from '../services/gem.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const spendSchema = z.object({
  amount: z.number().min(1),
  source: z.enum(['model_unlock', 'ad_free_pass', 'cosmetic', 'gift_card']),
  referenceId: z.string().optional(),
  description: z.string().optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function gemRoutes(app: FastifyInstance) {
  // GET /balance
  app.get('/balance', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const balance = await GemService.getBalance(new Types.ObjectId(userId));
      return reply.send(balance);
    },
  });

  // GET /transactions
  app.get('/transactions', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { limit, cursor } = request.query as { limit?: number; cursor?: string };
      const result = await GemService.getTransactions(
        new Types.ObjectId(userId),
        { limit, cursor }
      );
      return reply.send(result);
    },
  });

  // POST /spend
  app.post('/spend', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const body = spendSchema.parse(request.body);
      const { transaction, newBalance } = await GemService.spendGems({
        userId: new Types.ObjectId(userId),
        amount: body.amount,
        source: body.source,
        referenceId: body.referenceId,
        description: body.description || `Spent ${body.amount} gems on ${body.source}`,
      });
      return reply.send({ transaction, newBalance });
    },
  });

  // GET /store
  app.get('/store', {
    handler: async (_request, reply) => {
      const store = await GemService.getStore();
      return reply.send({ items: store });
    },
  });

  // GET /leaderboard
  app.get('/leaderboard', {
    handler: async (request, reply) => {
      const { limit, period } = request.query as { limit?: number; period?: string };
      const leaderboard = await GemService.getLeaderboard({
        limit,
        period: (period as 'all' | 'weekly' | 'monthly') || 'all',
      });
      return reply.send({ leaderboard });
    },
  });
}
