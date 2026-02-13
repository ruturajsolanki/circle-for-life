/**
 * Circle for Life — Voice Routes
 *
 * Handles:
 * - Whisper API transcription (cloud)
 * - Whisper API audio translation (any language → English)
 * - ElevenLabs TTS proxy
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import { localAuthenticate } from '../middleware/rbac.middleware.js';
import { logger } from '../utils/logger.js';

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function voiceRoutes(app: FastifyInstance) {
  /**
   * POST /voice/transcribe
   * Transcribe audio using OpenAI Whisper API.
   * Accepts base64-encoded audio data.
   */
  app.post('/transcribe', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = z.object({
        audioBase64: z.string().min(1, 'Audio data required'),
        apiKey: z.string().min(1, 'OpenAI API key required'),
        language: z.string().optional(),
        model: z.string().optional().default('whisper-1'),
      }).parse(request.body);

      try {
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(body.audioBase64, 'base64');

        // Create form data for Whisper API
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', audioBuffer, { filename: 'audio.webm', contentType: 'audio/webm' });
        form.append('model', body.model);
        if (body.language) form.append('language', body.language);
        form.append('response_format', 'json');

        const startTime = Date.now();
        const response = await axios.post(
          'https://api.openai.com/v1/audio/transcriptions',
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${body.apiKey}`,
            },
            timeout: 60000,
            maxContentLength: 25 * 1024 * 1024,
          },
        );

        return reply.send({
          text: response.data.text || '',
          language: response.data.language || body.language || '',
          model: body.model,
          latencyMs: Date.now() - startTime,
        });
      } catch (error: any) {
        logger.error('Whisper transcribe error:', error?.response?.data || error.message);
        return reply.status(error?.response?.status || 500).send({
          error: error?.response?.data?.error?.message || error.message || 'Transcription failed',
        });
      }
    },
  });

  /**
   * POST /voice/translate-audio
   * Translate audio to English using OpenAI Whisper API.
   * Takes audio in any language and outputs English text.
   */
  app.post('/translate-audio', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = z.object({
        audioBase64: z.string().min(1, 'Audio data required'),
        apiKey: z.string().min(1, 'OpenAI API key required'),
        model: z.string().optional().default('whisper-1'),
      }).parse(request.body);

      try {
        const audioBuffer = Buffer.from(body.audioBase64, 'base64');
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', audioBuffer, { filename: 'audio.webm', contentType: 'audio/webm' });
        form.append('model', body.model);
        form.append('response_format', 'json');

        const startTime = Date.now();
        const response = await axios.post(
          'https://api.openai.com/v1/audio/translations',
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${body.apiKey}`,
            },
            timeout: 60000,
            maxContentLength: 25 * 1024 * 1024,
          },
        );

        return reply.send({
          text: response.data.text || '',
          targetLanguage: 'English',
          model: body.model,
          latencyMs: Date.now() - startTime,
        });
      } catch (error: any) {
        logger.error('Whisper translate error:', error?.response?.data || error.message);
        return reply.status(error?.response?.status || 500).send({
          error: error?.response?.data?.error?.message || error.message || 'Audio translation failed',
        });
      }
    },
  });

  /**
   * POST /voice/tts/elevenlabs
   * Text-to-speech via ElevenLabs API.
   * Returns audio as base64.
   */
  app.post('/tts/elevenlabs', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = z.object({
        text: z.string().min(1).max(5000),
        apiKey: z.string().min(1, 'ElevenLabs API key required'),
        voiceId: z.string().optional().default('21m00Tcm4TlvDq8ikWAM'), // Rachel (default)
        modelId: z.string().optional().default('eleven_monolingual_v1'),
      }).parse(request.body);

      try {
        const startTime = Date.now();
        const response = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${body.voiceId}`,
          {
            text: body.text,
            model_id: body.modelId,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          },
          {
            headers: {
              'xi-api-key': body.apiKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            responseType: 'arraybuffer',
            timeout: 30000,
          },
        );

        const audioBase64 = Buffer.from(response.data).toString('base64');

        return reply.send({
          audioBase64,
          contentType: 'audio/mpeg',
          latencyMs: Date.now() - startTime,
        });
      } catch (error: any) {
        logger.error('ElevenLabs TTS error:', error?.response?.data || error.message);
        return reply.status(error?.response?.status || 500).send({
          error: error?.response?.data?.detail?.message || error.message || 'TTS failed',
        });
      }
    },
  });

  /**
   * GET /voice/elevenlabs/voices
   * List available ElevenLabs voices.
   */
  app.post('/elevenlabs/voices', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = z.object({
        apiKey: z.string().min(1),
      }).parse(request.body);

      try {
        const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': body.apiKey },
          timeout: 10000,
        });

        const voices = (response.data.voices || []).map((v: any) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
          labels: v.labels,
        }));

        return reply.send({ voices });
      } catch (error: any) {
        return reply.status(error?.response?.status || 500).send({
          error: error?.response?.data?.detail?.message || error.message || 'Failed to fetch voices',
        });
      }
    },
  });
}
