import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import { ModerationService } from '../services/moderation.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const reportSchema = z.object({
  targetType: z.enum(['post', 'user']),
  targetId: z.string(),
  reason: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});

const appealSchema = z.object({
  targetType: z.enum(['post', 'user']),
  targetId: z.string(),
  reason: z.string().min(1).max(500),
  description: z.string().max(1000).optional(),
});

const reviewActionSchema = z.object({
  targetType: z.enum(['post', 'user']),
  targetId: z.string(),
  action: z.enum(['approve', 'reject', 'warn', 'shadow_ban', 'ban']),
  notes: z.string().optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function moderationRoutes(app: FastifyInstance) {
  // POST /reports
  app.post('/reports', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const reporterId = (request as any).userId;
      const body = reportSchema.parse(request.body);
      const result = await ModerationService.processReport({
        reporterId: new Types.ObjectId(reporterId),
        targetType: body.targetType,
        targetId: new Types.ObjectId(body.targetId),
        reason: body.reason,
        description: body.description,
      });
      return reply.status(201).send(result);
    },
  });

  // GET /appeals
  app.get('/appeals', {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { status, limit, cursor } = request.query as {
        status?: string;
        limit?: number;
        cursor?: string;
      };
      const result = await ModerationService.getAppeals({
        status,
        limit,
        cursor,
      });
      return reply.send(result);
    },
  });

  // POST /appeals
  app.post('/appeals', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const body = appealSchema.parse(request.body);
      const result = await ModerationService.processAppeal({
        userId: new Types.ObjectId(userId),
        targetType: body.targetType,
        targetId: new Types.ObjectId(body.targetId),
        reason: body.reason,
        description: body.description,
      });
      return reply.status(201).send(result);
    },
  });

  // GET /queue — Admin moderation queue
  app.get('/queue', {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const { status, limit, cursor } = request.query as {
        status?: string;
        limit?: number;
        cursor?: string;
      };
      const queue = await ModerationService.getModerationQueue({
        status: status || 'flagged',
        limit,
        cursor,
      });
      return reply.send({ queue });
    },
  });

  // POST /queue/action — Admin review action
  app.post('/queue/action', {
    preHandler: [requireAdmin],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const body = reviewActionSchema.parse(request.body);
      await ModerationService.reviewAction({
        targetType: body.targetType,
        targetId: new Types.ObjectId(body.targetId),
        action: body.action,
        reviewedBy: userId,
        notes: body.notes,
      });
      return reply.status(204).send();
    },
  });
}
