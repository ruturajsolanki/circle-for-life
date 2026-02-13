import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { GenerationService } from '../services/generation.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const createJobSchema = z.object({
  prompt: z.string().min(1).max(1000),
  refinedPrompt: z.string().min(1).max(2000),
  model: z.enum(['sdxl-turbo', 'flux', 'midjourney']),
  generationParams: z
    .object({
      steps: z.number().optional(),
      cfgScale: z.number().optional(),
      negativePrompt: z.string().optional(),
    })
    .optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function generationRoutes(app: FastifyInstance) {
  // POST /create
  app.post('/create', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const body = createJobSchema.parse(request.body);
      const result = await GenerationService.createJob({
        userId: new Types.ObjectId(userId),
        prompt: body.prompt,
        refinedPrompt: body.refinedPrompt,
        model: body.model,
        generationParams: body.generationParams,
      });
      return reply.status(201).send(result);
    },
  });

  // GET /history — must be before /:jobId for route precedence
  app.get('/history', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { limit, cursor } = request.query as { limit?: number; cursor?: string };
      const result = await GenerationService.getHistory(
        new Types.ObjectId(userId),
        { limit, cursor }
      );
      return reply.send(result);
    },
  });

  // GET /:jobId
  app.get('/:jobId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { jobId } = request.params as { jobId: string };
      const job = await GenerationService.getJobStatus(jobId, new Types.ObjectId(userId));
      return reply.send(job);
    },
  });

  // POST /:jobId/retry
  app.post('/:jobId/retry', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { jobId } = request.params as { jobId: string };
      const result = await GenerationService.retry(jobId, new Types.ObjectId(userId));
      return reply.send(result);
    },
  });
}
