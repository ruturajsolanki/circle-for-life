/**
 * Circle for Life — Translation Routes
 *
 * Text-to-text translation, language detection, and translation history.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { localAuthenticate } from '../middleware/rbac.middleware.js';
import { translationHistoryDB } from '../db/index.js';
import { TranslationService, SUPPORTED_LANGUAGES } from '../services/translation.service.js';
import { ChatProvider } from '../services/controlPanel.service.js';

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function translateRoutes(app: FastifyInstance) {
  /**
   * GET /translate/languages
   * List supported languages.
   */
  app.get('/languages', async (_request, reply) => {
    return reply.send({ languages: SUPPORTED_LANGUAGES });
  });

  /**
   * POST /translate/text
   * Translate text using an LLM provider.
   */
  app.post('/text', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = z.object({
        text: z.string().min(1).max(10000),
        sourceLang: z.string().optional().default(''),
        targetLang: z.string().min(1),
        provider: z.string().min(1),
        apiKey: z.string().min(1),
        model: z.string().optional(),
        sourceType: z.enum(['text', 'voice']).optional().default('text'),
        saveHistory: z.boolean().optional().default(true),
      }).parse(request.body);

      const userId = (request as any).user?.id;

      try {
        const result = await TranslationService.translate({
          text: body.text,
          sourceLang: body.sourceLang || undefined,
          targetLang: body.targetLang,
          provider: body.provider as ChatProvider,
          apiKey: body.apiKey,
          model: body.model,
        });

        // Save to history
        if (body.saveHistory && userId) {
          try {
            await translationHistoryDB.create({
              id: `tr_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
              userId,
              sourceText: body.text.substring(0, 5000),
              sourceLanguage: body.sourceLang || result.detectedSourceLang || '',
              targetLanguage: body.targetLang,
              translatedText: result.translatedText.substring(0, 5000),
              provider: result.provider,
              model: result.model,
              sourceType: body.sourceType,
              createdAt: new Date().toISOString(),
            });
          } catch { /* non-critical */ }
        }

        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({
          error: error.error || error.message || 'Translation failed',
        });
      }
    },
  });

  /**
   * POST /translate/detect
   * Detect the language of a text.
   */
  app.post('/detect', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = z.object({
        text: z.string().min(1).max(5000),
        provider: z.string().min(1),
        apiKey: z.string().min(1),
        model: z.string().optional(),
      }).parse(request.body);

      try {
        const result = await TranslationService.detectLanguage(
          body.text,
          body.provider as ChatProvider,
          body.apiKey,
          body.model,
        );
        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({
          error: error.error || error.message || 'Detection failed',
        });
      }
    },
  });

  /**
   * GET /translate/history
   * List user's translation history.
   */
  app.get('/history', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const userId = (request as any).user?.id;
      if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

      const q = (request as any).query || {};
      const page = parseInt(q.page) || 1;
      const limit = Math.min(parseInt(q.limit) || 20, 50);

      try {
        let items = await translationHistoryDB.findMany({ userId });
        items.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const total = items.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const pageItems = items.slice(start, start + limit);

        return reply.send({
          translations: pageItems,
          pagination: { page, limit, total, totalPages },
        });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    },
  });

  /**
   * DELETE /translate/history/:id
   * Delete a translation history entry.
   */
  app.delete('/history/:id', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const userId = (request as any).user?.id;
      const id = (request as any).params?.id;

      try {
        const item = await translationHistoryDB.findById(id);
        if (!item) return reply.status(404).send({ error: 'Not found' });
        if (item.userId !== userId) {
          const isAdmin = ['admin', 'super_admin'].includes((request as any).user?.role);
          if (!isAdmin) return reply.status(403).send({ error: 'Not authorized' });
        }

        await translationHistoryDB.deleteById(id);
        return reply.send({ success: true });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    },
  });
}
