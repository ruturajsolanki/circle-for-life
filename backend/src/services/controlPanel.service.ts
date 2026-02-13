import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger.js';

// ─── Supported Providers ────────────────────────────────────────────────────

export type ChatProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'mistral'
  | 'openrouter'
  | 'together'
  | 'deepseek'
  | 'kaggle';

export type ImageProvider =
  | 'openai'        // DALL-E
  | 'stability'     // Stable Diffusion
  | 'bfl'           // Black Forest Labs / Flux
  | 'replicate'     // Any model on Replicate
  | 'runpod'        // RunPod Serverless
  | 'fal';          // fal.ai

export interface ProviderConfig {
  provider: ChatProvider | ImageProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;  // for custom / self-hosted endpoints
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  provider: ProviderConfig;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface ImageGenRequest {
  provider: ProviderConfig;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
}

export interface ImageGenResponse {
  imageUrl?: string;      // URL to the generated image
  imageBase64?: string;   // base64 for inline providers
  model: string;
  provider: string;
  latencyMs: number;
}

// ─── Provider Endpoint Maps ─────────────────────────────────────────────────

const CHAT_ENDPOINTS: Record<ChatProvider, { url: string; authHeader: string }> = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    authHeader: 'Bearer',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    authHeader: 'x-api-key',
  },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    authHeader: 'Bearer',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    authHeader: 'Bearer',
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    authHeader: 'Bearer',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    authHeader: 'Bearer',
  },
  together: {
    url: 'https://api.together.xyz/v1/chat/completions',
    authHeader: 'Bearer',
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    authHeader: 'Bearer',
  },
  kaggle: {
    url: 'http://localhost:11434/v1/chat/completions', // Overridden by user's ngrok URL
    authHeader: 'Bearer',
  },
};

// ─── Default Models ─────────────────────────────────────────────────────────

const DEFAULT_MODELS: Record<ChatProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-small-latest',
  openrouter: 'meta-llama/llama-3.3-70b-instruct',
  together: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  deepseek: 'deepseek-chat',
  kaggle: 'llama3.2:3b',
};

const DEFAULT_IMAGE_MODELS: Record<ImageProvider, string> = {
  openai: 'dall-e-3',
  stability: 'stable-diffusion-xl-1024-v1-0',
  bfl: 'flux-pro-1.1',
  replicate: 'black-forest-labs/flux-schnell',
  runpod: 'sdxl-turbo',
  fal: 'fal-ai/flux/schnell',
};

// ─── Control Panel Service ──────────────────────────────────────────────────

export class ControlPanelService {
  /**
   * Send a chat completion request to any supported provider.
   * Normalizes the request/response format across providers.
   */
  static async chat(req: ChatRequest): Promise<ChatResponse> {
    const { provider, messages, maxTokens = 1024, temperature = 0.7 } = req;
    const providerName = provider.provider as ChatProvider;
    const model = provider.model || DEFAULT_MODELS[providerName];
    const startTime = Date.now();

    try {
      // ─── Anthropic (different API format) ─────────────────────────
      if (providerName === 'anthropic') {
        return await this.chatAnthropic(provider, messages, model, maxTokens, temperature, startTime);
      }

      // ─── Google Gemini (different API format) ─────────────────────
      if (providerName === 'google') {
        return await this.chatGoogle(provider, messages, model, maxTokens, temperature, startTime);
      }

      // ─── OpenAI-compatible providers ──────────────────────────────
      // (openai, groq, mistral, openrouter, together, deepseek)
      return await this.chatOpenAICompatible(provider, messages, model, maxTokens, temperature, startTime);

    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      logger.error(`Chat error [${providerName}/${model}]:`, error?.response?.data || error.message);
      throw {
        provider: providerName,
        model,
        error: error?.response?.data?.error?.message || error.message || 'Unknown error',
        status: error?.response?.status || 500,
        latencyMs,
      };
    }
  }

  /**
   * OpenAI-compatible chat (works for OpenAI, Groq, Mistral, OpenRouter, Together, DeepSeek).
   */
  private static async chatOpenAICompatible(
    provider: ProviderConfig,
    messages: ChatMessage[],
    model: string,
    maxTokens: number,
    temperature: number,
    startTime: number,
  ): Promise<ChatResponse> {
    const providerName = provider.provider as ChatProvider;
    let endpoint = provider.baseUrl || CHAT_ENDPOINTS[providerName].url;

    // Kaggle/Ollama: append API path if user provided root URL
    if (providerName === 'kaggle' && provider.baseUrl) {
      const base = provider.baseUrl.replace(/\/+$/, '');
      if (!base.includes('/v1/')) {
        endpoint = `${base}/v1/chat/completions`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Kaggle/Ollama doesn't need auth; all others do
    if (providerName !== 'kaggle') {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    // OpenRouter needs extra headers
    if (providerName === 'openrouter') {
      headers['HTTP-Referer'] = 'https://circleforlife.app';
      headers['X-Title'] = 'Circle for Life Control Panel';
    }

    const response = await axios.post(
      endpoint,
      {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      },
      { headers, timeout: 60000 }
    );

    const choice = response.data.choices?.[0];
    const usage = response.data.usage;

    return {
      content: choice?.message?.content || '',
      model: response.data.model || model,
      provider: providerName,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Anthropic Messages API (different format from OpenAI).
   */
  private static async chatAnthropic(
    provider: ProviderConfig,
    messages: ChatMessage[],
    model: string,
    maxTokens: number,
    temperature: number,
    startTime: number,
  ): Promise<ChatResponse> {
    // Anthropic separates system message
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMsgs = messages.filter((m) => m.role !== 'system');

    const body: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: chatMsgs.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const response = await axios.post(
      provider.baseUrl || 'https://api.anthropic.com/v1/messages',
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 60000,
      }
    );

    const content = response.data.content?.[0]?.text || '';
    const usage = response.data.usage;

    return {
      content,
      model: response.data.model || model,
      provider: 'anthropic',
      usage: usage
        ? {
            promptTokens: usage.input_tokens,
            completionTokens: usage.output_tokens,
            totalTokens: usage.input_tokens + usage.output_tokens,
          }
        : undefined,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Google Gemini API.
   */
  private static async chatGoogle(
    provider: ProviderConfig,
    messages: ChatMessage[],
    model: string,
    maxTokens: number,
    temperature: number,
    startTime: number,
  ): Promise<ChatResponse> {
    // Convert OpenAI-style messages to Gemini format
    const systemInstruction = messages.find((m) => m.role === 'system');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.apiKey}`;

    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }

    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    const candidate = response.data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    const usageMetadata = response.data.usageMetadata;

    return {
      content,
      model,
      provider: 'google',
      usage: usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount || 0,
            completionTokens: usageMetadata.candidatesTokenCount || 0,
            totalTokens: usageMetadata.totalTokenCount || 0,
          }
        : undefined,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Generate an image using any supported image provider.
   */
  static async generateImage(req: ImageGenRequest): Promise<ImageGenResponse> {
    const { provider, prompt, negativePrompt, width = 1024, height = 1024, steps } = req;
    const providerName = provider.provider as ImageProvider;
    const model = provider.model || DEFAULT_IMAGE_MODELS[providerName];
    const startTime = Date.now();

    try {
      switch (providerName) {
        case 'openai':
          return await this.imageOpenAI(provider, prompt, model, width, height, startTime);
        case 'stability':
          return await this.imageStability(provider, prompt, negativePrompt, model, width, height, steps, startTime);
        case 'bfl':
          return await this.imageBFL(provider, prompt, model, width, height, startTime);
        case 'replicate':
          return await this.imageReplicate(provider, prompt, model, width, height, startTime);
        case 'fal':
          return await this.imageFal(provider, prompt, model, width, height, startTime);
        default:
          throw new Error(`Unsupported image provider: ${providerName}`);
      }
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      logger.error(`Image gen error [${providerName}/${model}]:`, error?.response?.data || error.message);
      throw {
        provider: providerName,
        model,
        error: error?.response?.data?.error?.message || error.message || 'Unknown error',
        status: error?.response?.status || 500,
        latencyMs,
      };
    }
  }

  /**
   * OpenAI DALL-E image generation.
   */
  private static async imageOpenAI(
    provider: ProviderConfig,
    prompt: string,
    model: string,
    width: number,
    height: number,
    startTime: number,
  ): Promise<ImageGenResponse> {
    // DALL-E 3 supports specific sizes
    const size = width >= 1792 ? '1792x1024' : height >= 1792 ? '1024x1792' : '1024x1024';

    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model,
        prompt,
        n: 1,
        size,
        response_format: 'url',
      },
      {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    return {
      imageUrl: response.data.data?.[0]?.url,
      model,
      provider: 'openai',
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Stability AI image generation.
   */
  private static async imageStability(
    provider: ProviderConfig,
    prompt: string,
    negativePrompt: string | undefined,
    model: string,
    width: number,
    height: number,
    steps: number | undefined,
    startTime: number,
  ): Promise<ImageGenResponse> {
    const response = await axios.post(
      `https://api.stability.ai/v1/generation/${model}/text-to-image`,
      {
        text_prompts: [
          { text: prompt, weight: 1 },
          ...(negativePrompt ? [{ text: negativePrompt, weight: -1 }] : []),
        ],
        cfg_scale: 7,
        width: Math.min(width, 1024),
        height: Math.min(height, 1024),
        steps: steps || 30,
        samples: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 120000,
      }
    );

    const base64 = response.data.artifacts?.[0]?.base64;

    return {
      imageBase64: base64 ? `data:image/png;base64,${base64}` : undefined,
      model,
      provider: 'stability',
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Black Forest Labs (Flux) image generation.
   */
  private static async imageBFL(
    provider: ProviderConfig,
    prompt: string,
    model: string,
    width: number,
    height: number,
    startTime: number,
  ): Promise<ImageGenResponse> {
    // Start generation
    const createResp = await axios.post(
      `https://api.bfl.ml/v1/${model}`,
      { prompt, width, height },
      {
        headers: { 'x-key': provider.apiKey, 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    const taskId = createResp.data.id;

    // Poll for result (max 2 minutes)
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusResp = await axios.get(
        `https://api.bfl.ml/v1/get_result?id=${taskId}`,
        { headers: { 'x-key': provider.apiKey } }
      );

      if (statusResp.data.status === 'Ready') {
        return {
          imageUrl: statusResp.data.result?.sample,
          model,
          provider: 'bfl',
          latencyMs: Date.now() - startTime,
        };
      }

      if (statusResp.data.status === 'Error') {
        throw new Error(statusResp.data.result || 'BFL generation failed');
      }
    }

    throw new Error('BFL generation timed out');
  }

  /**
   * Replicate image generation (any model).
   */
  private static async imageReplicate(
    provider: ProviderConfig,
    prompt: string,
    model: string,
    width: number,
    height: number,
    startTime: number,
  ): Promise<ImageGenResponse> {
    // Create prediction
    const createResp = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        model,
        input: { prompt, width, height },
      },
      {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const predictionId = createResp.data.id;

    // Poll for result
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusResp = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { Authorization: `Bearer ${provider.apiKey}` } }
      );

      if (statusResp.data.status === 'succeeded') {
        const output = statusResp.data.output;
        return {
          imageUrl: Array.isArray(output) ? output[0] : output,
          model,
          provider: 'replicate',
          latencyMs: Date.now() - startTime,
        };
      }

      if (statusResp.data.status === 'failed') {
        throw new Error(statusResp.data.error || 'Replicate generation failed');
      }
    }

    throw new Error('Replicate generation timed out');
  }

  /**
   * fal.ai image generation.
   */
  private static async imageFal(
    provider: ProviderConfig,
    prompt: string,
    model: string,
    width: number,
    height: number,
    startTime: number,
  ): Promise<ImageGenResponse> {
    const response = await axios.post(
      `https://queue.fal.run/${model}`,
      {
        prompt,
        image_size: { width, height },
        num_images: 1,
      },
      {
        headers: {
          Authorization: `Key ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    // fal queue returns a request_id — poll status endpoint
    const requestId = response.data.request_id;

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusResp = await axios.get(
        `https://queue.fal.run/${model}/requests/${requestId}/status`,
        { headers: { Authorization: `Key ${provider.apiKey}` } }
      );

      if (statusResp.data.status === 'COMPLETED') {
        const resultResp = await axios.get(
          `https://queue.fal.run/${model}/requests/${requestId}`,
          { headers: { Authorization: `Key ${provider.apiKey}` } }
        );
        return {
          imageUrl: resultResp.data.images?.[0]?.url,
          model,
          provider: 'fal',
          latencyMs: Date.now() - startTime,
        };
      }

      if (statusResp.data.status === 'FAILED') {
        throw new Error('fal.ai generation failed');
      }
    }

    throw new Error('fal.ai generation timed out');
  }

  /**
   * List available models for a provider. Useful for the control panel dropdown.
   */
  static getAvailableModels(): {
    chat: Record<ChatProvider, string[]>;
    image: Record<ImageProvider, string[]>;
  } {
    return {
      chat: {
        openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini', 'o3-mini'],
        anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        google: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
        mistral: ['mistral-large-latest', 'mistral-small-latest', 'mistral-medium-latest', 'open-mistral-nemo'],
        openrouter: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-001'],
        together: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
        deepseek: ['deepseek-chat', 'deepseek-reasoner'],
      },
      image: {
        openai: ['dall-e-3', 'dall-e-2'],
        stability: ['stable-diffusion-xl-1024-v1-0', 'stable-diffusion-v1-6'],
        bfl: ['flux-pro-1.1', 'flux-dev', 'flux-pro'],
        replicate: ['black-forest-labs/flux-schnell', 'black-forest-labs/flux-dev', 'stability-ai/sdxl'],
        runpod: ['sdxl-turbo', 'sdxl'],
        fal: ['fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro/v1.1'],
      },
    };
  }

  /**
   * Fetch live models from a provider's API using the user's key.
   * Falls back to the static list if the API call fails.
   */
  static async fetchLiveModels(
    provider: ChatProvider,
    apiKey: string,
  ): Promise<{ models: { id: string; name: string; owned_by?: string }[]; source: 'live' | 'fallback' }> {
    try {
      switch (provider) {
        // ─── OpenAI-compatible /v1/models endpoints ──────────────────
        case 'openai': {
          const r = await axios.get('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
          });
          const models = (r.data.data || [])
            .filter((m: any) => m.id.startsWith('gpt') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('chatgpt'))
            .sort((a: any, b: any) => a.id.localeCompare(b.id))
            .map((m: any) => ({ id: m.id, name: m.id, owned_by: m.owned_by }));
          return { models, source: 'live' };
        }

        case 'groq': {
          const r = await axios.get('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
          });
          const models = (r.data.data || [])
            .sort((a: any, b: any) => a.id.localeCompare(b.id))
            .map((m: any) => ({ id: m.id, name: m.id, owned_by: m.owned_by }));
          return { models, source: 'live' };
        }

        case 'mistral': {
          const r = await axios.get('https://api.mistral.ai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
          });
          const models = (r.data.data || [])
            .sort((a: any, b: any) => a.id.localeCompare(b.id))
            .map((m: any) => ({ id: m.id, name: m.id, owned_by: m.owned_by }));
          return { models, source: 'live' };
        }

        case 'openrouter': {
          const r = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
          });
          const models = (r.data.data || [])
            .slice(0, 100) // limit — openrouter has thousands
            .map((m: any) => ({ id: m.id, name: m.name || m.id, owned_by: m.id.split('/')[0] }));
          return { models, source: 'live' };
        }

        case 'together': {
          const r = await axios.get('https://api.together.xyz/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
          });
          const models = (r.data || [])
            .filter((m: any) => m.type === 'chat' || m.display_type === 'chat')
            .slice(0, 80)
            .map((m: any) => ({ id: m.id, name: m.display_name || m.id, owned_by: m.organization }));
          return { models, source: 'live' };
        }

        case 'deepseek': {
          const r = await axios.get('https://api.deepseek.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
          });
          const models = (r.data.data || [])
            .map((m: any) => ({ id: m.id, name: m.id, owned_by: 'deepseek' }));
          return { models, source: 'live' };
        }

        // ─── Providers without a models endpoint ─────────────────────
        case 'google': {
          const r = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { timeout: 10000 }
          );
          const models = (r.data.models || [])
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => ({
              id: m.name?.replace('models/', '') || m.name,
              name: m.displayName || m.name,
              owned_by: 'google',
            }));
          return { models, source: 'live' };
        }

        case 'anthropic': {
          // Anthropic doesn't have a /models endpoint — return curated list
          return {
            models: [
              { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', owned_by: 'anthropic' },
              { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', owned_by: 'anthropic' },
              { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet v2', owned_by: 'anthropic' },
              { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', owned_by: 'anthropic' },
              { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', owned_by: 'anthropic' },
            ],
            source: 'fallback',
          };
        }

        default:
          throw new Error('Unsupported provider');
      }
    } catch (error: any) {
      logger.warn(`Failed to fetch live models for ${provider}: ${error.message}`);
      // Fallback to static list
      const staticModels = this.getAvailableModels().chat[provider] || [];
      return {
        models: staticModels.map(id => ({ id, name: id })),
        source: 'fallback',
      };
    }
  }
}
