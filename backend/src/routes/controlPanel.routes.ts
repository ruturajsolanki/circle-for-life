import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { localAuthenticate } from '../middleware/rbac.middleware.js';
import {
  ControlPanelService,
  ChatProvider,
  ImageProvider,
} from '../services/controlPanel.service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const chatProviders: ChatProvider[] = [
  'openai', 'anthropic', 'google', 'groq', 'mistral', 'openrouter', 'together', 'deepseek', 'kaggle',
];

const imageProviders: ImageProvider[] = [
  'openai', 'stability', 'bfl', 'replicate', 'runpod', 'fal',
];

const chatRequestSchema = z.object({
  provider: z.enum(chatProviders as [string, ...string[]]),
  apiKey: z.string().min(1, 'API key is required').or(z.literal('ollama')),
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1),
    })
  ).min(1, 'At least one message required'),
  maxTokens: z.number().min(1).max(16384).optional().default(1024),
  temperature: z.number().min(0).max(2).optional().default(0.7),
});

const imageRequestSchema = z.object({
  provider: z.enum(imageProviders as [string, ...string[]]),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().optional(),
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(1000).optional(),
  width: z.number().min(256).max(2048).optional().default(1024),
  height: z.number().min(256).max(2048).optional().default(1024),
  steps: z.number().min(1).max(150).optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function controlPanelRoutes(app: FastifyInstance) {
  /**
   * GET /control-panel/providers
   * List all available providers and their models.
   * No auth required — this is reference data.
   */
  app.get('/providers', async (_request, reply) => {
    const models = ControlPanelService.getAvailableModels();

    return reply.send({
      chat: Object.entries(models.chat).map(([provider, modelList]) => ({
        provider,
        models: modelList,
        label: providerLabels[provider] || provider,
      })),
      image: Object.entries(models.image).map(([provider, modelList]) => ({
        provider,
        models: modelList,
        label: imageProviderLabels[provider] || provider,
      })),
    });
  });

  /**
   * POST /control-panel/chat
   * Send a chat completion to any provider.
   * User supplies their own API key — we proxy the request.
   */
  app.post('/chat', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = chatRequestSchema.parse(request.body);

      const result = await ControlPanelService.chat({
        provider: {
          provider: body.provider as ChatProvider,
          apiKey: body.apiKey,
          model: body.model,
          baseUrl: body.baseUrl,
        },
        messages: body.messages,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
      });

      return reply.send(result);
    },
  });

  /**
   * POST /control-panel/image
   * Generate an image using any provider.
   * User supplies their own API key.
   */
  app.post('/image', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = imageRequestSchema.parse(request.body);

      const result = await ControlPanelService.generateImage({
        provider: {
          provider: body.provider as ImageProvider,
          apiKey: body.apiKey,
          model: body.model,
        },
        prompt: body.prompt,
        negativePrompt: body.negativePrompt,
        width: body.width,
        height: body.height,
        steps: body.steps,
      });

      return reply.send(result);
    },
  });

  /**
   * POST /control-panel/models
   * Fetch available models from a provider using the user's API key.
   * Auto-populates the model dropdown in the UI.
   */
  app.post('/models', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = z.object({
        provider: z.enum(chatProviders as [string, ...string[]]),
        apiKey: z.string().min(1).or(z.literal('ollama')),
      }).parse(request.body);

      const result = await ControlPanelService.fetchLiveModels(
        body.provider as ChatProvider,
        body.apiKey,
      );

      return reply.send(result);
    },
  });

  /**
   * POST /control-panel/chat/test
   * Quick connection test — sends a minimal request to verify the API key works.
   * Returns success/failure without a full generation.
   */
  app.post('/chat/test', {
    preHandler: [localAuthenticate],
    handler: async (request, reply) => {
      const body = z.object({
        provider: z.enum(chatProviders as [string, ...string[]]),
        apiKey: z.string().min(1).or(z.literal('ollama')),
        model: z.string().optional(),
        baseUrl: z.string().url().optional(),
      }).parse(request.body);

      try {
        const result = await ControlPanelService.chat({
          provider: {
            provider: body.provider as ChatProvider,
            apiKey: body.apiKey,
            model: body.model,
            baseUrl: body.baseUrl,
          },
          messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
          maxTokens: 5,
          temperature: 0,
        });

        return reply.send({
          success: true,
          provider: body.provider,
          model: result.model,
          latencyMs: result.latencyMs,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          provider: body.provider,
          error: error.error || error.message || 'Connection failed',
          latencyMs: error.latencyMs,
        });
      }
    },
  });
}

// ─── Display Labels ─────────────────────────────────────────────────────────

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  groq: 'Groq',
  mistral: 'Mistral AI',
  openrouter: 'OpenRouter',
  together: 'Together AI',
  deepseek: 'DeepSeek',
  kaggle: 'Kaggle / Ollama (Free GPU)',
};

const imageProviderLabels: Record<string, string> = {
  openai: 'OpenAI (DALL-E)',
  stability: 'Stability AI',
  bfl: 'Black Forest Labs (Flux)',
  replicate: 'Replicate',
  runpod: 'RunPod',
  fal: 'fal.ai',
};
