import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth.middleware.js';
import { VoteService } from '../services/vote.service.js';

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function voteRoutes(app: FastifyInstance) {
  // POST /posts/:postId/vote
  app.post('/posts/:postId/vote', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { postId } = request.params as { postId: string };
      const deviceId = (request.headers['x-device-id'] as string) || 'unknown';
      const ipHash = (request as any).ip || 'unknown';

      const result = await VoteService.castVote({
        userId: new Types.ObjectId(userId),
        postId: new Types.ObjectId(postId),
        deviceId,
        ipHash,
      });

      if (!result.success && result.error) {
        return reply.status(400).send({
          error: { code: result.error, message: result.error },
          newVoteCount: result.newVoteCount,
          dailyVotesRemaining: result.dailyVotesRemaining,
        });
      }

      return reply.send({
        newVoteCount: result.newVoteCount,
        dailyVotesRemaining: result.dailyVotesRemaining,
      });
    },
  });

  // DELETE /posts/:postId/vote
  app.delete('/posts/:postId/vote', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const { postId } = request.params as { postId: string };

      const result = await VoteService.undoVote({
        userId: new Types.ObjectId(userId),
        postId: new Types.ObjectId(postId),
      });

      if (!result.success) {
        return reply.status(400).send({
          error: { code: 'VOTE_001', message: 'Cannot undo vote' },
        });
      }

      return reply.send({ newVoteCount: result.newVoteCount });
    },
  });

  // GET /daily-status
  app.get('/daily-status', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).userId;
      const status = await VoteService.getDailyStatus(new Types.ObjectId(userId));
      return reply.send(status);
    },
  });
}
