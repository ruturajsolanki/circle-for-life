import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcrypt';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface IDevice {
  deviceId: string;
  platform: 'ios' | 'android';
  lastSeenAt: Date;
  pushToken?: string;
}

export interface IOAuthProvider {
  provider: 'google' | 'apple' | 'twitter';
  providerId: string;
  connectedAt: Date;
}

export interface IUser extends Document {
  _id: Types.ObjectId;

  // Identity
  username: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;

  // Profile
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  profileTheme?: string;

  // OAuth
  oauthProviders: IOAuthProvider[];

  // Tier
  tier: 'free' | 'pro' | 'premium';
  tierExpiresAt?: Date;

  // Gem Economy
  gemBalance: number;
  totalGemsEarned: number;
  totalGemsSpent: number;

  // Engagement
  totalPosts: number;
  totalVotesReceived: number;
  totalVotesGiven: number;
  followersCount: number;
  followingCount: number;

  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;

  // Referral
  referralCode: string;
  referredBy?: Types.ObjectId;
  referralCount: number;
  referralBonusExpiresAt?: Date;

  // Trust & Safety
  trustScore: number;
  shadowBanned: boolean;
  bannedAt?: Date;
  banReason?: string;
  reportCount: number;

  // Devices
  devices: IDevice[];

  // Rate Limiting
  dailyVotesUsed: number;
  dailyVotesResetAt?: Date;
  dailyGenerationsUsed: number;
  dailyGenerationsResetAt?: Date;

  // Feature Flags
  featureFlags: Record<string, boolean>;

  // Notifications
  notificationPreferences: {
    push: boolean;
    email: boolean;
    inApp: boolean;
    marketing: boolean;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  deletedAt?: Date;

  // Methods
  comparePassword(password: string): Promise<boolean>;
  isRateLimitedForVotes(): boolean;
  isRateLimitedForGenerations(): boolean;
  getEffectiveGemMultiplier(): number;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_]+$/,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    passwordHash: { type: String, required: true, select: false },

    displayName: { type: String, required: true, maxlength: 50 },
    avatarUrl: String,
    bio: { type: String, maxlength: 160 },
    profileTheme: { type: String, default: 'default' },

    oauthProviders: [
      {
        provider: { type: String, enum: ['google', 'apple', 'twitter'] },
        providerId: String,
        connectedAt: { type: Date, default: Date.now },
      },
    ],

    tier: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'free',
      index: true,
    },
    tierExpiresAt: Date,

    gemBalance: { type: Number, default: 0, min: 0 },
    totalGemsEarned: { type: Number, default: 0 },
    totalGemsSpent: { type: Number, default: 0 },

    totalPosts: { type: Number, default: 0 },
    totalVotesReceived: { type: Number, default: 0 },
    totalVotesGiven: { type: Number, default: 0 },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },

    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: String,

    referralCode: {
      type: String,
      unique: true,
      index: true,
    },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },
    referralBonusExpiresAt: Date,

    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    shadowBanned: { type: Boolean, default: false, index: true },
    bannedAt: Date,
    banReason: String,
    reportCount: { type: Number, default: 0 },

    devices: [
      {
        deviceId: { type: String, index: true },
        platform: { type: String, enum: ['ios', 'android'] },
        lastSeenAt: Date,
        pushToken: String,
      },
    ],

    dailyVotesUsed: { type: Number, default: 0 },
    dailyVotesResetAt: Date,
    dailyGenerationsUsed: { type: Number, default: 0 },
    dailyGenerationsResetAt: Date,

    featureFlags: { type: Schema.Types.Mixed, default: {} },

    notificationPreferences: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
    },

    lastLoginAt: Date,
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Compound Indexes ───────────────────────────────────────────────────────

userSchema.index({ tier: 1, gemBalance: -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActiveDate: 1 });

// ─── Pre-save Hooks ─────────────────────────────────────────────────────────

userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash') && this.passwordHash) {
    // passwordHash already contains the raw password at creation time
    // We hash it here. After this, it's the bcrypt hash.
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

// ─── Methods ────────────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.isRateLimitedForVotes = function (): boolean {
  const now = new Date();
  if (this.dailyVotesResetAt && this.dailyVotesResetAt > now) {
    return this.dailyVotesUsed >= 100; // env.DAILY_VOTE_LIMIT
  }
  return false;
};

userSchema.methods.isRateLimitedForGenerations = function (): boolean {
  const now = new Date();
  const limits: Record<string, number> = {
    free: 10,
    pro: 50,
    premium: 999999,
  };
  if (this.dailyGenerationsResetAt && this.dailyGenerationsResetAt > now) {
    return this.dailyGenerationsUsed >= (limits[this.tier] || 10);
  }
  return false;
};

userSchema.methods.getEffectiveGemMultiplier = function (): number {
  if (
    this.referralBonusExpiresAt &&
    this.referralBonusExpiresAt > new Date()
  ) {
    return 2.0;
  }
  return 1.0;
};

// ─── Export ─────────────────────────────────────────────────────────────────

export const User = mongoose.model<IUser>('User', userSchema);
