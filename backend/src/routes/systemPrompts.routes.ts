/**
 * Circle for Life — System Prompts Routes
 *
 * Admin-only CRUD for editable system prompts used by
 * translation, safety, and injection detection pipelines.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { localAuthenticate, requireRole } from '../middleware/rbac.middleware.js';
import { systemPromptsDB, logAudit } from '../db/index.js';
import { logger } from '../utils/logger.js';
import {
  DEFAULT_SAFETY_PROMPT,
  DEFAULT_INJECTION_PROMPT,
  DEFAULT_TRANSLATION_PROMPT,
} from '../services/safety.service.js';

// ─── Default Prompts ─────────────────────────────────────────────────────────

export const SYSTEM_PROMPT_DEFAULTS: Record<string, { label: string; content: string }> = {
  translation: {
    label: 'Translation',
    content: DEFAULT_TRANSLATION_PROMPT,
  },
  safety_scan: {
    label: 'Safety Scan',
    content: DEFAULT_SAFETY_PROMPT,
  },
  injection_guard: {
    label: 'Injection Guard',
    content: DEFAULT_INJECTION_PROMPT,
  },
};

/**
 * Seed default system prompts if they don't exist.
 */
export async function seedSystemPrompts(): Promise<void> {
  for (const [key, def] of Object.entries(SYSTEM_PROMPT_DEFAULTS)) {
    try {
      const existing = await systemPromptsDB.findOne({ key });
      if (!existing) {
        await systemPromptsDB.create({
          id: `sp_${key}`,
          key,
          label: def.label,
          content: def.content,
          version: 1,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
        });
        logger.info(`Seeded system prompt: ${key}`);
      }
    } catch (err: any) {
      logger.warn(`Failed to seed prompt ${key}: ${err.message}`);
    }
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function systemPromptsRoutes(app: FastifyInstance) {
  /**
   * GET /system-prompts
   * List all system prompts. Admin only.
   */
  app.get('/', {
    preHandler: [localAuthenticate, requireRole('admin')],
    handler: async (_request, reply) => {
      try {
        const prompts = await systemPromptsDB.findAll();
        return reply.send({ prompts });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    },
  });

  /**
   * PUT /system-prompts/:key
   * Update a system prompt. Admin only.
   */
  app.put('/:key', {
    preHandler: [localAuthenticate, requireRole('admin')],
    handler: async (request, reply) => {
      const key = (request as any).params?.key;
      const body = z.object({
        content: z.string().min(10, 'Prompt must be at least 10 characters'),
      }).parse(request.body);

      const userId = (request as any).user?.id;

      try {
        const existing = await systemPromptsDB.findOne({ key });
        if (!existing) {
          return reply.status(404).send({ error: `Prompt '${key}' not found` });
        }

        const updated = await systemPromptsDB.updateById(existing.id, {
          content: body.content,
          version: (parseInt(existing.version) || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: userId || 'admin',
        });

        await logAudit({
          actorId: userId,
          actorRole: (request as any).user?.role || 'admin',
          action: 'update_system_prompt',
          targetType: 'system_prompt',
          targetId: key,
          details: `Updated prompt "${key}" to version ${(parseInt(existing.version) || 0) + 1}`,
        });

        return reply.send({ success: true, prompt: updated });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    },
  });

  /**
   * POST /system-prompts/:key/reset
   * Reset a system prompt to its default. Admin only.
   */
  app.post('/:key/reset', {
    preHandler: [localAuthenticate, requireRole('admin')],
    handler: async (request, reply) => {
      const key = (request as any).params?.key;
      const userId = (request as any).user?.id;

      const defaults = SYSTEM_PROMPT_DEFAULTS[key];
      if (!defaults) {
        return reply.status(404).send({ error: `No default found for prompt '${key}'` });
      }

      try {
        const existing = await systemPromptsDB.findOne({ key });
        if (!existing) {
          return reply.status(404).send({ error: `Prompt '${key}' not found` });
        }

        const updated = await systemPromptsDB.updateById(existing.id, {
          content: defaults.content,
          version: (parseInt(existing.version) || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: userId || 'admin',
        });

        await logAudit({
          actorId: userId,
          actorRole: (request as any).user?.role || 'admin',
          action: 'reset_system_prompt',
          targetType: 'system_prompt',
          targetId: key,
        });

        return reply.send({ success: true, prompt: updated });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    },
  });
}
