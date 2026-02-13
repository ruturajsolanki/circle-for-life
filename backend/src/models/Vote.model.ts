import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVote extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  postAuthorId: Types.ObjectId;
  deviceId: string;
  ipHash: string;
  sessionId?: string;
  gemAwarded: boolean;
  gemBatchId?: string;
  fraudScore: number;
  flagged: boolean;
  createdAt: Date;
}

const voteSchema = new Schema<IVote>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    postAuthorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deviceId: { type: String, required: true },
    ipHash: { type: String, required: true },
    sessionId: String,
    gemAwarded: { type: Boolean, default: false },
    gemBatchId: String,
    fraudScore: { type: Number, default: 0, min: 0, max: 1 },
    flagged: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Unique compound: one vote per user per post
voteSchema.index({ postId: 1, userId: 1 }, { unique: true });
voteSchema.index({ userId: 1, createdAt: -1 });
voteSchema.index({ postAuthorId: 1, gemAwarded: 1 });
voteSchema.index({ createdAt: -1 });
voteSchema.index({ ipHash: 1, createdAt: -1 });
voteSchema.index({ deviceId: 1, createdAt: -1 });

// Auto-expire old votes (90 days) to manage collection size
voteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const Vote = mongoose.model<IVote>('Vote', voteSchema);
