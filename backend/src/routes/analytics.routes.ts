import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { AnalyticsService } from '../services/analytics.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const trackEventSchema = z.object({
  event: z.string().min(1).max(100),
  properties: z.record(z.any()).optional(),
  deviceId: z.string().optional(),
  sessionId: z.string().optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function analyticsRoutes(app: FastifyInstance) {
  // POST /events/track
  app.post('/events/track', {
    preHandler: [optionalAuth],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const body = trackEventSchema.parse(request.body);
      await AnalyticsService.track({
        userId: userId ? new Types.ObjectId(userId) : undefined,
        deviceId: body.deviceId,
        sessionId: body.sessionId,
        event: body.event,
        properties: body.properties,
      });
      return reply.status(204).send();
    },
  });

  // GET /flags
  app.get('/flags', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const flags = await AnalyticsService.getFlags(new Types.ObjectId(userId));
      return reply.send({ flags });
    },
  });
}
