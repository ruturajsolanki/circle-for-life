import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { PostService } from '../services/post.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const createPostSchema = z.object({
  prompt: z.string().min(1).max(1000),
  refinedPrompt: z.string().min(1).max(2000),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url(),
  imageWidth: z.number().min(1).max(4096),
  imageHeight: z.number().min(1).max(4096),
  model: z.enum(['sdxl-turbo', 'flux', 'midjourney']),
  generationTimeMs: z.number().min(0),
  category: z.string().optional(),
  visibility: z.enum(['public', 'followers', 'private']).optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function postRoutes(app: FastifyInstance) {
  // POST / — Create post
  app.post('/', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const body = createPostSchema.parse(request.body);
      const post = await PostService.create({
        userId: new Types.ObjectId(userId),
        ...body,
      });
      return reply.status(201).send(post);
    },
  });

  // GET /:postId
  app.get('/:postId', {
    handler: async (request, reply) => {
      const { postId } = request.params as { postId: string };
      const userId = (request as any).userId;
      const post = await PostService.getById(
        postId,
        userId ? new Types.ObjectId(userId) : undefined
      );
      return reply.send(post);
    },
  });

  // DELETE /:postId
  app.delete('/:postId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { postId } = request.params as { postId: string };
      await PostService.delete(postId, new Types.ObjectId(userId));
      return reply.status(204).send();
    },
  });

  // GET /:postId/voters
  app.get('/:postId/voters', {
    handler: async (request, reply) => {
      const { postId } = request.params as { postId: string };
      const { limit } = request.query as { limit?: number };
      const voters = await PostService.getVoters(postId, limit);
      return reply.send({ voters });
    },
  });
}
