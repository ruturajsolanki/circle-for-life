import mongoose, { Schema, Document, Types } from 'mongoose';

export type GemTransactionType = 'earn' | 'spend' | 'refund' | 'admin_adjust';
export type GemSource =
  | 'votes'
  | 'daily_login'
  | 'streak_bonus'
  | 'referral'
  | 'trending_bonus'
  | 'purchase'
  | 'model_unlock'
  | 'ad_free_pass'
  | 'cosmetic'
  | 'gift_card'
  | 'admin';

export interface IGemTransaction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: GemTransactionType;
  source: GemSource;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string;
  referenceType?: string;
  multiplier: number;
  baseAmount: number;
  description: string;
  metadata?: Record<string, any>;
  idempotencyKey: string;
  createdAt: Date;
}

const gemTransactionSchema = new Schema<IGemTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['earn', 'spend', 'refund', 'admin_adjust'],
      required: true,
    },
    source: {
      type: String,
      enum: [
        'votes',
        'daily_login',
        'streak_bonus',
        'referral',
        'trending_bonus',
        'purchase',
        'model_unlock',
        'ad_free_pass',
        'cosmetic',
        'gift_card',
        'admin',
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceId: String,
    referenceType: String,
    multiplier: { type: Number, default: 1.0 },
    baseAmount: { type: Number, required: true },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

gemTransactionSchema.index({ userId: 1, createdAt: -1 });
gemTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
gemTransactionSchema.index({ source: 1, createdAt: -1 });

export const GemTransaction = mongoose.model<IGemTransaction>(
  'GemTransaction',
  gemTransactionSchema
);
