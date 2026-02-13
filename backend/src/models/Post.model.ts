import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface IGenerationParams {
  steps?: number;
  cfgScale?: number;
  seed?: number;
  negativePrompt?: string;
}

export interface IPost extends Document {
  _id: Types.ObjectId;

  // Author (denormalized for feed performance)
  userId: Types.ObjectId;
  username: string;
  userAvatarUrl?: string;
  userTier: string;

  // Content
  prompt: string;
  refinedPrompt: string;
  imageUrl: string;
  thumbnailUrl: string;
  imageWidth: number;
  imageHeight: number;
  blurhash?: string;

  // Generation Metadata
  model: 'sdxl-turbo' | 'flux' | 'midjourney';
  modelVersion?: string;
  generationTimeMs: number;
  generationParams?: IGenerationParams;
  hasWatermark: boolean;

  // Engagement Counters
  voteCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;

  // Ranking Scores
  engagementScore: number;
  trendingScore: number;
  hotScore: number;
  gemMultiplier: number;

  // Discovery
  tags: string[];
  category?: string;
  nsfw: boolean;
  nsfwScore: number;

  // Moderation
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationReviewedAt?: Date;
  moderationReviewedBy?: string;
  moderationNotes?: string;

  // Sharing
  shareableUrl?: string;
  shareCaption?: string;

  // Visibility
  visibility: 'public' | 'followers' | 'private';
  isPinned: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  // Methods
  calculateTrendingScore(): number;
  calculateHotScore(): number;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const postSchema = new Schema<IPost>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    username: { type: String, required: true },
    userAvatarUrl: String,
    userTier: { type: String, default: 'free' },

    prompt: { type: String, required: true, maxlength: 1000 },
    refinedPrompt: { type: String, required: true, maxlength: 2000 },
    imageUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    imageWidth: { type: Number, required: true },
    imageHeight: { type: Number, required: true },
    blurhash: String,

    model: {
      type: String,
      enum: ['sdxl-turbo', 'flux', 'midjourney'],
      required: true,
    },
    modelVersion: String,
    generationTimeMs: { type: Number, required: true },
    generationParams: {
      steps: Number,
      cfgScale: Number,
      seed: Number,
      negativePrompt: String,
    },
    hasWatermark: { type: Boolean, default: true },

    voteCount: { type: Number, default: 0, index: true },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    engagementScore: { type: Number, default: 0, index: true },
    trendingScore: { type: Number, default: 0, index: true },
    hotScore: { type: Number, default: 0, index: true },
    gemMultiplier: { type: Number, default: 1.0 },

    tags: {
      type: [String],
      index: true,
      validate: {
        validator: (v: string[]) => v.length <= 10,
        message: 'Maximum 10 tags allowed',
      },
    },
    category: {
      type: String,
      enum: [
        'art',
        'meme',
        'landscape',
        'portrait',
        'abstract',
        'fantasy',
        'scifi',
        'anime',
        'photography',
        'other',
      ],
      index: true,
    },
    nsfw: { type: Boolean, default: false },
    nsfwScore: { type: Number, default: 0, min: 0, max: 1 },

    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'pending',
      index: true,
    },
    moderationReviewedAt: Date,
    moderationReviewedBy: String,
    moderationNotes: String,

    shareableUrl: String,
    shareCaption: String,

    visibility: {
      type: String,
      enum: ['public', 'followers', 'private'],
      default: 'public',
      index: true,
    },
    isPinned: { type: Boolean, default: false },

    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Compound Indexes ───────────────────────────────────────────────────────

postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ trendingScore: -1, createdAt: -1 });
postSchema.index({ hotScore: -1 });
postSchema.index({ category: 1, trendingScore: -1 });
postSchema.index({ moderationStatus: 1, createdAt: -1 });
postSchema.index({ userId: 1, voteCount: -1 });

// Full-text search index
postSchema.index({ prompt: 'text', tags: 'text' });

// ─── Methods ────────────────────────────────────────────────────────────────

/**
 * Time-decayed trending score.
 * Uses gravity-based decay similar to Hacker News algorithm.
 * Score = (votes - 1) / (age_in_hours + 2) ^ gravity
 */
postSchema.methods.calculateTrendingScore = function (): number {
  const gravity = 1.8;
  const ageInHours =
    (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  const votes = Math.max(this.voteCount, 0);

  return (votes - 1) / Math.pow(ageInHours + 2, gravity);
};

/**
 * Wilson score lower bound.
 * Provides a "confidence" ranking — posts with more votes AND higher
 * vote ratios rank higher. Since we only have upvotes, we use
 * a simplified version with a phantom "no vote" baseline.
 */
postSchema.methods.calculateHotScore = function (): number {
  const n = this.voteCount + this.viewCount * 0.01; // views count slightly
  if (n === 0) return 0;

  const z = 1.96; // 95% confidence
  const phat = this.voteCount / Math.max(n, 1);
  const denominator = 1 + (z * z) / n;
  const centerAdjustedProbability =
    phat + (z * z) / (2 * n) - z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n);

  return centerAdjustedProbability / denominator;
};

// ─── Export ─────────────────────────────────────────────────────────────────

export const Post = mongoose.model<IPost>('Post', postSchema);
