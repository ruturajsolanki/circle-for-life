import { Types } from 'mongoose';
import { GenerationJob } from '../models/GenerationJob.model.js';
import { User } from '../models/User.model.js';
import { Queue } from 'bullmq';
import { getRedis } from '../config/database.js';
import { ModerationService } from './moderation.service.js';
import { GemService } from './gem.service.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import axios from 'axios';
import sharp from 'sharp';

// ─── Generation Configuration ───────────────────────────────────────────────

const GEN_CONFIG = {
  // Model definitions
  MODELS: {
    'sdxl-turbo': {
      name: 'SDXL Turbo',
      tier: 'free',
      gemCost: 0,
      provider: 'runpod',
      avgTimeMs: 3000,
      costPerGenUsd: 0.003,
      maxSteps: 4,
      defaultSteps: 2,
      resolution: { width: 1024, height: 1024 },
    },
    flux: {
      name: 'Flux Pro',
      tier: 'pro',
      gemCost: 5,
      provider: 'bfl',
      avgTimeMs: 15000,
      costPerGenUsd: 0.04,
      maxSteps: 50,
      defaultSteps: 28,
      resolution: { width: 1024, height: 1024 },
    },
    midjourney: {
      name: 'MJ Premium',
      tier: 'premium',
      gemCost: 10,
      provider: 'midjourney',
      avgTimeMs: 60000,
      costPerGenUsd: 0.08,
      maxSteps: 0, // N/A for MJ
      defaultSteps: 0,
      resolution: { width: 1024, height: 1024 },
    },
  },

  // Rate limits by tier
  DAILY_LIMITS: {
    free: 10,
    pro: 50,
    premium: 200,
  },

  // Queue configuration
  QUEUE_MAX_SIZE: 10000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,

  // Watermark
  WATERMARK_TEXT: 'Made with Circle for Life',
  WATERMARK_OPACITY: 0.4,
  WATERMARK_FONT_SIZE: 24,

  // Thumbnails
  THUMBNAIL_WIDTH: 400,
  THUMBNAIL_QUALITY: 80,
};

// ─── Generation Queue ───────────────────────────────────────────────────────

let imageGenQueue: Queue | null = null;

function getImageGenQueue(): Queue {
  if (!imageGenQueue) {
    imageGenQueue = new Queue('image-generation', {
      connection: {
        host: new URL(env.REDIS_URL).hostname,
        port: parseInt(new URL(env.REDIS_URL).port || '6379'),
      },
      defaultJobOptions: {
        attempts: GEN_CONFIG.MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: GEN_CONFIG.RETRY_DELAY_MS,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return imageGenQueue;
}

// ─── Generation Service ─────────────────────────────────────────────────────

export class GenerationService {
  /**
   * Create a new image generation job.
   *
   * Flow:
   * 1. Validate user tier can access requested model
   * 2. Check daily generation limit
   * 3. Run prompt through moderation
   * 4. Charge gems if premium model
   * 5. Create job record
   * 6. Queue for processing
   * 7. Return job ID for polling
   */
  static async createJob(params: {
    userId: Types.ObjectId;
    prompt: string;
    refinedPrompt: string;
    model: 'sdxl-turbo' | 'flux' | 'midjourney';
    generationParams?: {
      steps?: number;
      cfgScale?: number;
      negativePrompt?: string;
    };
  }): Promise<{
    jobId: string;
    status: string;
    estimatedWaitMs: number;
  }> {
    const { userId, prompt, refinedPrompt, model, generationParams } = params;

    const modelConfig = GEN_CONFIG.MODELS[model];
    if (!modelConfig) {
      throw new Error('GEN_001: Invalid model');
    }

    // ─── Step 1: Tier Validation ──────────────────────────────────────

    const user = await User.findById(userId);
    if (!user) throw new Error('USER_001: User not found');

    const tierHierarchy = { free: 0, pro: 1, premium: 2 };
    const requiredTier = tierHierarchy[modelConfig.tier as keyof typeof tierHierarchy] || 0;
    const userTier = tierHierarchy[user.tier as keyof typeof tierHierarchy] || 0;

    // Users can access models at their tier or below, OR pay gems
    const canAccess = userTier >= requiredTier || modelConfig.gemCost > 0;
    if (!canAccess) {
      throw new Error(`GEN_001: ${modelConfig.name} requires ${modelConfig.tier} tier`);
    }

    // ─── Step 2: Rate Limit Check ─────────────────────────────────────

    const redis = getRedis();
    const today = new Date().toISOString().split('T')[0];
    const rateLimitKey = `rate:gen:${userId}:${today}`;
    const currentCount = parseInt((await redis.get(rateLimitKey)) || '0', 10);
    const dailyLimit = GEN_CONFIG.DAILY_LIMITS[user.tier as keyof typeof GEN_CONFIG.DAILY_LIMITS] || 10;

    if (currentCount >= dailyLimit) {
      throw new Error('RATE_003: Daily generation limit reached');
    }

    // ─── Step 3: Prompt Moderation ────────────────────────────────────

    const moderationResult = await ModerationService.analyzePrompt({
      prompt,
      refinedPrompt,
      userId,
    });

    if (!moderationResult.allowed) {
      throw new Error(moderationResult.reason || 'MOD_001: Content rejected');
    }

    // ─── Step 4: Charge Gems (if premium model) ──────────────────────

    if (modelConfig.gemCost > 0 && userTier < requiredTier) {
      await GemService.spendGems({
        userId,
        amount: modelConfig.gemCost,
        source: 'model_unlock',
        referenceType: 'generation',
        description: `${modelConfig.name} generation`,
      });
    }

    // ─── Step 5: Create Job Record ────────────────────────────────────

    // Priority: premium > pro > free, earlier > later
    const priority = userTier * 100 + (user.trustScore || 50);

    const job = await GenerationJob.create({
      userId,
      prompt,
      refinedPrompt,
      model,
      priority,
      status: 'queued',
      attempts: 0,
    });

    // ─── Step 6: Queue for Processing ─────────────────────────────────

    const queue = getImageGenQueue();
    await queue.add(
      'generate',
      {
        jobId: job._id.toString(),
        userId: userId.toString(),
        prompt,
        refinedPrompt,
        model,
        params: generationParams,
        userTier: user.tier,
      },
      {
        priority: 1000 - priority, // BullMQ: lower number = higher priority
        jobId: job._id.toString(),
      }
    );

    // Increment rate limit counter
    await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, 86400);

    // ─── Step 7: Estimate Wait Time ───────────────────────────────────

    const queueDepth = await queue.count();
    const estimatedWaitMs = modelConfig.avgTimeMs + queueDepth * 500;

    logger.info(
      `Generation job created: ${job._id} model=${model} queue_depth=${queueDepth}`
    );

    return {
      jobId: job._id.toString(),
      status: 'queued',
      estimatedWaitMs,
    };
  }

  /**
   * Get generation history for a user.
   */
  static async getHistory(
    userId: Types.ObjectId,
    params: { limit?: number; cursor?: string }
  ): Promise<{ jobs: any[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit || 20, 50);
    const query: any = { userId };
    if (params.cursor) {
      query._id = { $lt: new Types.ObjectId(params.cursor) };
    }
    const jobs = await GenerationJob.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .select('prompt model status imageUrl thumbnailUrl createdAt')
      .lean();
    const hasMore = jobs.length > limit;
    const result = hasMore ? jobs.slice(0, limit) : jobs;
    const nextCursor = hasMore
      ? result[result.length - 1]._id.toString()
      : null;
    return { jobs: result, nextCursor };
  }

  /**
   * Retry a failed generation job.
   */
  static async retry(
    jobId: string,
    userId: Types.ObjectId
  ): Promise<{ jobId: string; status: string }> {
    const job = await GenerationJob.findOne({ _id: jobId, userId });
    if (!job) throw new Error('Job not found');
    if (job.status !== 'failed') {
      throw new Error('GEN_003: Only failed jobs can be retried');
    }
    if (job.attempts >= GEN_CONFIG.MAX_RETRIES) {
      throw new Error('GEN_004: Max retries exceeded');
    }

    job.status = 'queued';
    job.attempts = 0;
    job.lastError = undefined;
    await job.save();

    const queue = getImageGenQueue();
    const user = await User.findById(userId).select('tier').lean();
    await queue.add(
      'generate',
      {
        jobId: job._id.toString(),
        userId: userId.toString(),
        prompt: job.prompt,
        refinedPrompt: job.refinedPrompt,
        model: job.model,
        params: {},
        userTier: user?.tier || 'free',
      },
      { priority: 1000, jobId: job._id.toString() }
    );

    return { jobId: job._id.toString(), status: 'queued' };
  }

  /**
   * Get job status (for polling).
   */
  static async getJobStatus(
    jobId: string,
    userId: Types.ObjectId
  ): Promise<any> {
    const job = await GenerationJob.findOne({
      _id: jobId,
      userId,
    });

    if (!job) throw new Error('Job not found');

    const response: any = {
      jobId: job._id,
      status: job.status,
    };

    if (job.status === 'completed') {
      response.imageUrl = job.imageUrl;
      response.thumbnailUrl = job.thumbnailUrl;
      response.blurhash = job.blurhash;
      response.generationTimeMs = job.generationTimeMs;
    } else if (job.status === 'queued') {
      const queue = getImageGenQueue();
      const queueDepth = await queue.count();
      const modelConfig = GEN_CONFIG.MODELS[job.model];
      response.estimatedWaitMs = modelConfig.avgTimeMs + queueDepth * 500;
    } else if (job.status === 'failed') {
      response.error = 'GEN_002: Generation failed. Please retry.';
    }

    return response;
  }

  /**
   * Process a generation job (called by worker).
   *
   * This is the actual GPU call. It:
   * 1. Calls the appropriate provider API
   * 2. Downloads the result
   * 3. Adds watermark (for free tier)
   * 4. Creates thumbnail
   * 5. Uploads to S3/R2
   * 6. Updates job record
   * 7. Runs image moderation
   */
  static async processJob(jobData: {
    jobId: string;
    userId: string;
    prompt: string;
    refinedPrompt: string;
    model: string;
    params?: any;
    userTier: string;
  }): Promise<void> {
    const { jobId, userId, refinedPrompt, model, params, userTier } = jobData;
    const modelConfig = GEN_CONFIG.MODELS[model as keyof typeof GEN_CONFIG.MODELS];

    // Mark as processing
    await GenerationJob.updateOne(
      { _id: jobId },
      { $set: { status: 'processing', startedAt: new Date() } }
    );

    const startTime = Date.now();

    try {
      // ─── Call Provider ────────────────────────────────────────────

      let imageBuffer: Buffer;

      switch (modelConfig.provider) {
        case 'runpod':
          imageBuffer = await this.callRunPod(refinedPrompt, params);
          break;
        case 'bfl':
          imageBuffer = await this.callBFL(refinedPrompt, params);
          break;
        case 'midjourney':
          imageBuffer = await this.callMidjourney(refinedPrompt);
          break;
        default:
          throw new Error(`Unknown provider: ${modelConfig.provider}`);
      }

      // ─── Post-Process ─────────────────────────────────────────────

      // Add watermark for free tier users
      const needsWatermark = userTier === 'free';
      if (needsWatermark) {
        imageBuffer = await this.addWatermark(imageBuffer);
      }

      // Create thumbnail
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(GEN_CONFIG.THUMBNAIL_WIDTH)
        .jpeg({ quality: GEN_CONFIG.THUMBNAIL_QUALITY })
        .toBuffer();

      // Get image dimensions
      const metadata = await sharp(imageBuffer).metadata();

      // ─── Upload to Storage ────────────────────────────────────────

      // In production, upload to S3/R2 and return CDN URLs.
      // Pseudo-code for storage:
      const imageUrl = `${env.CDN_BASE_URL}/generations/${jobId}/image.webp`;
      const thumbnailUrl = `${env.CDN_BASE_URL}/generations/${jobId}/thumb.jpg`;

      // await uploadToS3(imageBuffer, `generations/${jobId}/image.webp`);
      // await uploadToS3(thumbnailBuffer, `generations/${jobId}/thumb.jpg`);

      const generationTimeMs = Date.now() - startTime;

      // ─── Update Job ───────────────────────────────────────────────

      await GenerationJob.updateOne(
        { _id: jobId },
        {
          $set: {
            status: 'completed',
            imageUrl,
            thumbnailUrl,
            imageWidth: metadata.width || 1024,
            imageHeight: metadata.height || 1024,
            generationTimeMs,
            computeCostUsd: modelConfig.costPerGenUsd,
            completedAt: new Date(),
          },
          $inc: { attempts: 1 },
        }
      );

      logger.info(
        `Generation complete: ${jobId} in ${generationTimeMs}ms`
      );

      // ─── Trigger Image Moderation (async) ─────────────────────────

      // Queue moderation check — don't block completion
      // moderationQueue.add('analyze-image', { postId: null, imageUrl, userId });
    } catch (error: any) {
      const attempts =
        (await GenerationJob.findById(jobId))?.attempts || 0;

      await GenerationJob.updateOne(
        { _id: jobId },
        {
          $set: {
            status: attempts >= GEN_CONFIG.MAX_RETRIES ? 'failed' : 'queued',
            lastError: error.message,
          },
          $inc: { attempts: 1 },
        }
      );

      logger.error(`Generation failed: ${jobId}`, error);
      throw error; // BullMQ will retry
    }
  }

  /**
   * Call RunPod Serverless (SDXL-Turbo).
   */
  private static async callRunPod(
    prompt: string,
    params?: any
  ): Promise<Buffer> {
    const response = await axios.post(
      'https://api.runpod.ai/v2/sdxl-turbo/run',
      {
        input: {
          prompt,
          num_inference_steps: params?.steps || 2,
          guidance_scale: params?.cfgScale || 0,
          width: 1024,
          height: 1024,
        },
      },
      {
        headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}` },
        timeout: 30000,
      }
    );

    // Poll for result
    const resultId = response.data.id;
    let result: any;
    let attempts = 0;

    while (attempts < 60) {
      await new Promise((r) => setTimeout(r, 1000));
      const statusResponse = await axios.get(
        `https://api.runpod.ai/v2/sdxl-turbo/status/${resultId}`,
        { headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}` } }
      );
      result = statusResponse.data;
      if (result.status === 'COMPLETED') break;
      if (result.status === 'FAILED') throw new Error('RunPod generation failed');
      attempts++;
    }

    // Download image
    const imageUrl = result.output?.image || result.output?.[0];
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    return Buffer.from(imageResponse.data);
  }

  /**
   * Call Black Forest Labs API (Flux).
   */
  private static async callBFL(
    prompt: string,
    params?: any
  ): Promise<Buffer> {
    const response = await axios.post(
      'https://api.bfl.ml/v1/flux-pro-1.1',
      {
        prompt,
        width: 1024,
        height: 1024,
      },
      {
        headers: { 'x-key': env.BFL_API_KEY },
        timeout: 60000,
      }
    );

    const resultId = response.data.id;

    // Poll for result
    let result: any;
    let attempts = 0;

    while (attempts < 120) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusResponse = await axios.get(
        `https://api.bfl.ml/v1/get_result?id=${resultId}`,
        { headers: { 'x-key': env.BFL_API_KEY } }
      );
      result = statusResponse.data;
      if (result.status === 'Ready') break;
      if (result.status === 'Error') throw new Error('BFL generation failed');
      attempts++;
    }

    const imageResponse = await axios.get(result.result.sample, {
      responseType: 'arraybuffer',
    });

    return Buffer.from(imageResponse.data);
  }

  /**
   * Call Midjourney API (via proxy).
   */
  private static async callMidjourney(prompt: string): Promise<Buffer> {
    // Midjourney doesn't have an official API.
    // Use a proxy service like GoAPI, ImagineAPI, or build custom Discord bot.
    // This is a placeholder for the proxy call.

    const response = await axios.post(
      'https://api.goapi.ai/mj/v2/imagine',
      {
        prompt,
        process_mode: 'fast',
      },
      {
        headers: {
          'x-api-key': env.MIDJOURNEY_API_KEY,
        },
        timeout: 120000,
      }
    );

    // Poll for completion...
    // Download result...
    // Return buffer

    // Placeholder
    throw new Error('Midjourney integration requires proxy API setup');
  }

  /**
   * Add watermark to image using Sharp.
   */
  private static async addWatermark(
    imageBuffer: Buffer
  ): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    // Create SVG watermark
    const svgWatermark = Buffer.from(`
      <svg width="${width}" height="${height}">
        <style>
          .watermark {
            fill: rgba(255, 255, 255, ${GEN_CONFIG.WATERMARK_OPACITY});
            font-family: Arial, sans-serif;
            font-size: ${GEN_CONFIG.WATERMARK_FONT_SIZE}px;
            font-weight: bold;
          }
        </style>
        <text 
          x="${width - 20}" 
          y="${height - 20}" 
          text-anchor="end" 
          class="watermark"
        >
          ${GEN_CONFIG.WATERMARK_TEXT}
        </text>
      </svg>
    `);

    return sharp(imageBuffer)
      .composite([
        {
          input: svgWatermark,
          top: 0,
          left: 0,
        },
      ])
      .webp({ quality: 90 })
      .toBuffer();
  }
}

export { GEN_CONFIG };
