import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGenerationJob extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  prompt: string;
  refinedPrompt: string;
  model: 'sdxl-turbo' | 'flux' | 'midjourney';
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  thumbnailUrl?: string;
  blurhash?: string;
  generationTimeMs?: number;
  workerId?: string;
  attempts: number;
  lastError?: string;
  computeCostUsd?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const generationJobSchema = new Schema<IGenerationJob>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    prompt: { type: String, required: true },
    refinedPrompt: { type: String, required: true },
    model: {
      type: String,
      enum: ['sdxl-turbo', 'flux', 'midjourney'],
      required: true,
    },
    priority: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
    },
    imageUrl: String,
    thumbnailUrl: String,
    blurhash: String,
    generationTimeMs: Number,
    workerId: String,
    attempts: { type: Number, default: 0 },
    lastError: String,
    computeCostUsd: Number,
    startedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

generationJobSchema.index({ userId: 1, createdAt: -1 });
generationJobSchema.index({ status: 1, priority: -1, createdAt: 1 });
generationJobSchema.index({ workerId: 1 });

// TTL: clean up completed jobs after 7 days
generationJobSchema.index({ completedAt: 1 }, { expireAfterSeconds: 604800 });

export const GenerationJob = mongoose.model<IGenerationJob>(
  'GenerationJob',
  generationJobSchema
);
