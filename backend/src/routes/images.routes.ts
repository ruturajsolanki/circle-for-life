/**
 * Circle for Life — Image Upload & Gallery Routes
 *
 * Handles uploading generated images to Supabase Storage,
 * listing a user's gallery, and deleting images.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { localAuthenticate } from '../middleware/rbac.middleware.js';
import { generatedImagesDB } from '../db/index.js';
import { env } from '../config/env.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 * Falls back to returning the original URL if not in Supabase mode.
 */
async function uploadToSupabaseStorage(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  if (env.DB_MODE !== 'supabase') {
    throw new Error('Storage upload requires Supabase mode');
  }

  const { getSupabase } = await import('../config/supabase.js');
  const sb = getSupabase();

  const path = `images/${filename}`;
  const { error } = await sb.storage
    .from('generated-images')
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = sb.storage.from('generated-images').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Download an image from a URL and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 20 * 1024 * 1024, // 20MB max
  });
  const contentType = resp.headers['content-type'] || 'image/png';
  return { buffer: Buffer.from(resp.data), contentType };
}

/**
 * Convert a base64 data URI to a Buffer.
 */
function base64ToBuffer(dataUri: string): { buffer: Buffer; contentType: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid base64 data URI');
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const uploadSchema = z.object({
  imageUrl: z.string().optional(),     // URL to fetch and persist
  imageBase64: z.string().optional(),  // base64 data URI
  prompt: z.string().min(1),
  negativePrompt: z.string().optional().default(''),
  provider: z.string().min(1),
  model: z.string().optional().default(''),
  width: z.number().optional().default(1024),
  height: z.number().optional().default(1024),
}).refine(d => d.imageUrl || d.imageBase64, {
  message: 'Either imageUrl or imageBase64 is required',
});

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function imageRoutes(app: FastifyInstance) {
  /**
   * POST /images/upload
   * Upload a generated image to Supabase Storage and save metadata.
   */
  app.post('/upload', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = uploadSchema.parse(request.body);
      const userId = (request as any).user?.id;
      if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

      let permanentUrl: string;
      const id = `img_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const ext = 'png';
      const filename = `${userId}/${id}.${ext}`;

      try {
        if (env.DB_MODE === 'supabase') {
          // Upload to Supabase Storage for permanent URL
          let buffer: Buffer;
          let contentType: string;

          if (body.imageBase64) {
            const parsed = base64ToBuffer(body.imageBase64);
            buffer = parsed.buffer;
            contentType = parsed.contentType;
          } else if (body.imageUrl) {
            const downloaded = await downloadImage(body.imageUrl);
            buffer = downloaded.buffer;
            contentType = downloaded.contentType;
          } else {
            return reply.status(400).send({ error: 'No image data provided' });
          }

          permanentUrl = await uploadToSupabaseStorage(buffer, filename, contentType);
        } else {
          // In local mode, just use the original URL (no permanent storage)
          permanentUrl = body.imageUrl || body.imageBase64 || '';
        }

        // Save metadata to DB
        const record = {
          id,
          userId,
          prompt: body.prompt,
          negativePrompt: body.negativePrompt || '',
          provider: body.provider,
          model: body.model || '',
          imageUrl: permanentUrl,
          width: body.width || 1024,
          height: body.height || 1024,
          createdAt: new Date().toISOString(),
        };

        await generatedImagesDB.create(record);

        return reply.send({
          success: true,
          image: record,
        });
      } catch (error: any) {
        app.log.error('Image upload error:', error);
        return reply.status(500).send({
          error: error.message || 'Failed to upload image',
        });
      }
    },
  });

  /**
   * GET /images
   * List user's generated images (gallery).
   */
  app.get('/', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const userId = (request as any).user?.id;
      if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

      const isAdmin = ['admin', 'super_admin'].includes((request as any).user?.role);
      const q = (request as any).query || {};
      const page = parseInt(q.page) || 1;
      const limit = Math.min(parseInt(q.limit) || 20, 50);

      try {
        let images: any[];

        if (isAdmin && q.all === 'true') {
          // Admin can see all images
          images = await generatedImagesDB.findAll();
        } else {
          images = await generatedImagesDB.findMany({ userId });
        }

        // Sort by createdAt descending
        images.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Paginate
        const total = images.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const pageImages = images.slice(start, start + limit);

        return reply.send({
          images: pageImages,
          pagination: { page, limit, total, totalPages },
        });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    },
  });

  /**
   * DELETE /images/:id
   * Delete an image from gallery and storage.
   */
  app.delete('/:id', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const userId = (request as any).user?.id;
      const imageId = (request as any).params?.id;
      if (!userId || !imageId) return reply.status(400).send({ error: 'Missing parameters' });

      try {
        const image = await generatedImagesDB.findById(imageId);
        if (!image) return reply.status(404).send({ error: 'Image not found' });

        const isAdmin = ['admin', 'super_admin'].includes((request as any).user?.role);
        if (image.userId !== userId && !isAdmin) {
          return reply.status(403).send({ error: 'Not authorized to delete this image' });
        }

        // Delete from Supabase Storage if applicable
        if (env.DB_MODE === 'supabase' && image.imageUrl?.includes('generated-images')) {
          try {
            const { getSupabase } = await import('../config/supabase.js');
            const sb = getSupabase();
            const path = `images/${image.userId}/${imageId}.png`;
            await sb.storage.from('generated-images').remove([path]);
          } catch (e: any) {
            app.log.warn('Failed to delete from storage:', e.message);
          }
        }

        await generatedImagesDB.deleteById(imageId);

        return reply.send({ success: true });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    },
  });
}
