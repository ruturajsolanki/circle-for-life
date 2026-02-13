# Circle for Life — Complete Database Schema

> MongoDB Collections with indexes, validation rules, and relationship mapping.

---

## Entity Relationship Overview

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Users   │────▶│  Posts    │────▶│  Votes   │
└──────────┘     └──────────┘     └──────────┘
     │                │                 │
     │                │                 │
     ▼                ▼                 ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Gems    │     │Moderation│     │ Analytics│
│  Ledger  │     │  Queue   │     │  Events  │
└──────────┘     └──────────┘     └──────────┘
     │
     ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Referrals│     │ Reports  │     │ Feature  │
│          │     │          │     │ Flags    │
└──────────┘     └──────────┘     └──────────┘
```

---

## Collection: `users`

```javascript
{
  _id: ObjectId,
  
  // Identity
  username: String,           // unique, 3-30 chars, alphanumeric + underscore
  email: String,              // unique, verified
  emailVerified: Boolean,
  passwordHash: String,       // bcrypt, 12 rounds
  
  // Profile
  displayName: String,        // 1-50 chars
  avatarUrl: String,          // CDN URL
  bio: String,                // max 160 chars
  profileTheme: String,       // unlockable cosmetic
  
  // OAuth
  oauthProviders: [{
    provider: String,         // 'google' | 'apple' | 'twitter'
    providerId: String,
    connectedAt: Date
  }],
  
  // Tier & Subscription
  tier: String,               // 'free' | 'pro' | 'premium'
  tierExpiresAt: Date,        // null for free
  
  // Gem Economy
  gemBalance: Number,         // current balance (denormalized for reads)
  totalGemsEarned: Number,    // lifetime earned
  totalGemsSpent: Number,     // lifetime spent
  
  // Engagement Metrics (denormalized)
  totalPosts: Number,
  totalVotesReceived: Number,
  totalVotesGiven: Number,
  followersCount: Number,
  followingCount: Number,
  
  // Streaks
  currentStreak: Number,      // consecutive daily logins
  longestStreak: Number,
  lastActiveDate: Date,       // YYYY-MM-DD string for streak calc
  
  // Referral
  referralCode: String,       // unique, 8 chars
  referredBy: ObjectId,       // user who referred this user
  referralCount: Number,      // how many users referred
  referralBonusExpiresAt: Date, // 2x gem multiplier window
  
  // Trust & Safety
  trustScore: Number,         // 0-100, starts at 50
  shadowBanned: Boolean,
  bannedAt: Date,
  banReason: String,
  reportCount: Number,
  
  // Device Fingerprinting
  devices: [{
    deviceId: String,         // unique device fingerprint
    platform: String,         // 'ios' | 'android'
    lastSeenAt: Date,
    pushToken: String
  }],
  
  // Rate Limiting State
  dailyVotesUsed: Number,
  dailyVotesResetAt: Date,
  dailyGenerationsUsed: Number,
  dailyGenerationsResetAt: Date,
  
  // Feature Flags (user-level overrides)
  featureFlags: Object,       // { flagName: Boolean }
  
  // Notifications
  notificationPreferences: {
    push: Boolean,
    email: Boolean,
    inApp: Boolean,
    marketing: Boolean
  },
  
  // Metadata
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date,
  deletedAt: Date             // soft delete
}

// INDEXES
// { username: 1 }                    unique
// { email: 1 }                       unique
// { referralCode: 1 }                unique
// { referredBy: 1 }
// { trustScore: 1 }
// { tier: 1, gemBalance: -1 }
// { createdAt: -1 }
// { shadowBanned: 1 }
// { "devices.deviceId": 1 }
// { lastActiveDate: 1 }             TTL or streak management
```

---

## Collection: `posts`

```javascript
{
  _id: ObjectId,
  
  // Author
  userId: ObjectId,           // ref: users
  username: String,           // denormalized for feed performance
  userAvatarUrl: String,      // denormalized
  userTier: String,           // denormalized
  
  // Content
  prompt: String,             // original user prompt
  refinedPrompt: String,      // LLM-enhanced prompt
  imageUrl: String,           // CDN URL (full resolution)
  thumbnailUrl: String,       // CDN URL (compressed for feed)
  imageWidth: Number,
  imageHeight: Number,
  blurhash: String,           // for placeholder loading
  
  // Generation Metadata
  model: String,              // 'sdxl-turbo' | 'flux' | 'midjourney'
  modelVersion: String,
  generationTimeMs: Number,
  generationParams: {
    steps: Number,
    cfgScale: Number,
    seed: Number,
    negativePrompt: String
  },
  hasWatermark: Boolean,      // true for free tier
  
  // Engagement (denormalized counters)
  voteCount: Number,          // total upvotes
  commentCount: Number,
  shareCount: Number,
  viewCount: Number,
  
  // Ranking
  engagementScore: Number,    // weighted composite score
  trendingScore: Number,      // time-decayed engagement
  hotScore: Number,           // Wilson score for "hot" feed
  gemMultiplier: Number,      // 1.0 default, 2.0 during referral bonus
  
  // Discovery
  tags: [String],             // AI-extracted tags, max 10
  category: String,           // 'art' | 'meme' | 'landscape' | 'portrait' | etc.
  nsfw: Boolean,
  nsfwScore: Number,          // 0.0-1.0 confidence
  
  // Moderation
  moderationStatus: String,   // 'pending' | 'approved' | 'rejected' | 'flagged'
  moderationReviewedAt: Date,
  moderationReviewedBy: String, // 'auto' | userId
  moderationNotes: String,
  
  // Sharing
  shareableUrl: String,       // short URL for sharing
  shareCaption: String,       // auto-generated share text
  
  // Visibility
  visibility: String,         // 'public' | 'followers' | 'private'
  isPinned: Boolean,          // pinned to user profile
  
  // Metadata
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date             // soft delete
}

// INDEXES
// { userId: 1, createdAt: -1 }               user's posts
// { createdAt: -1 }                          new feed
// { trendingScore: -1, createdAt: -1 }       trending feed
// { hotScore: -1 }                           hot feed
// { engagementScore: -1 }                    top posts
// { tags: 1 }                                tag search
// { category: 1, trendingScore: -1 }         category feeds
// { moderationStatus: 1, createdAt: -1 }     moderation queue
// { visibility: 1 }                          
// { "userId": 1, "voteCount": -1 }           user's top posts
// Text index on: { prompt: "text", tags: "text" }
```

---

## Collection: `votes`

```javascript
{
  _id: ObjectId,
  
  // Vote Details
  postId: ObjectId,           // ref: posts
  userId: ObjectId,           // ref: users (voter)
  postAuthorId: ObjectId,     // denormalized for quick gem calc
  
  // Anti-Fraud
  deviceId: String,           // device fingerprint
  ipHash: String,             // hashed IP for fraud detection
  sessionId: String,
  
  // Gem Processing
  gemAwarded: Boolean,        // whether this vote counted toward gems
  gemBatchId: String,         // which gem settlement batch
  
  // Metadata
  createdAt: Date,
  
  // Fraud Signal
  fraudScore: Number,         // 0.0-1.0, computed at vote time
  flagged: Boolean            // flagged for review
}

// INDEXES
// { postId: 1, userId: 1 }          unique compound (prevents double voting)
// { userId: 1, createdAt: -1 }      user's vote history
// { postAuthorId: 1, gemAwarded: 1 } gem settlement queries
// { createdAt: -1 }                  time-based queries
// { flagged: 1 }                     fraud review queue
// { ipHash: 1, createdAt: -1 }       IP-based fraud detection
// { deviceId: 1, createdAt: -1 }     device-based fraud detection
// TTL index: { createdAt: 1 }, expireAfterSeconds: 7776000  (90 days)
```

---

## Collection: `gem_transactions`

```javascript
{
  _id: ObjectId,
  
  // Transaction Details
  userId: ObjectId,           // ref: users
  type: String,               // 'earn' | 'spend' | 'refund' | 'admin_adjust'
  source: String,             // 'votes' | 'daily_login' | 'streak_bonus' | 
                              // 'referral' | 'trending_bonus' | 'purchase' |
                              // 'model_unlock' | 'ad_free_pass' | 'cosmetic' |
                              // 'gift_card' | 'admin'
  
  // Amount
  amount: Number,             // positive for earn, negative for spend
  balanceBefore: Number,
  balanceAfter: Number,
  
  // Reference
  referenceId: String,        // postId, referralId, productId, etc.
  referenceType: String,      // 'post' | 'referral' | 'product' | 'streak'
  
  // Multiplier
  multiplier: Number,         // 1.0 default, 2.0 during referral bonus
  baseAmount: Number,         // amount before multiplier
  
  // Metadata
  description: String,        // human-readable description
  metadata: Object,           // additional context
  
  // Idempotency
  idempotencyKey: String,     // unique, prevents double processing
  
  createdAt: Date
}

// INDEXES
// { userId: 1, createdAt: -1 }           user's transaction history
// { userId: 1, type: 1, createdAt: -1 }  filtered history
// { source: 1, createdAt: -1 }           economy analytics
// { idempotencyKey: 1 }                  unique
// { createdAt: -1 }                      global ledger queries
// TTL: none — gem transactions are permanent records
```

---

## Collection: `follows`

```javascript
{
  _id: ObjectId,
  followerId: ObjectId,       // the user who follows
  followingId: ObjectId,      // the user being followed
  createdAt: Date
}

// INDEXES
// { followerId: 1, followingId: 1 }      unique compound
// { followingId: 1 }                     "who follows me"
// { followerId: 1, createdAt: -1 }       "who I follow" ordered
```

---

## Collection: `referrals`

```javascript
{
  _id: ObjectId,
  
  // Referrer
  referrerId: ObjectId,       // user who shared the code
  referralCode: String,       // the code used
  
  // Referred
  referredUserId: ObjectId,   // new user who signed up
  
  // Attribution
  installSource: String,      // 'direct_link' | 'share_card' | 'qr_code'
  platform: String,           // 'ios' | 'android' | 'web'
  
  // Bonus
  bonusGemsAwarded: Number,   // gems given to referrer
  bonusMultiplierActive: Boolean,
  bonusExpiresAt: Date,       // 24h window
  
  // Anti-Abuse
  ipHash: String,
  deviceId: String,
  fraudScore: Number,
  validated: Boolean,         // passed anti-abuse checks
  
  createdAt: Date
}

// INDEXES
// { referrerId: 1, createdAt: -1 }
// { referredUserId: 1 }              unique
// { referralCode: 1 }
// { validated: 1 }
// { ipHash: 1 }                      fraud detection
```

---

## Collection: `reports`

```javascript
{
  _id: ObjectId,
  
  // Reporter
  reporterId: ObjectId,
  
  // Target
  targetType: String,         // 'post' | 'user' | 'comment'
  targetId: ObjectId,
  targetUserId: ObjectId,     // owner of reported content
  
  // Report Details
  reason: String,             // 'nsfw' | 'hate_speech' | 'spam' | 'harassment' | 
                              // 'impersonation' | 'copyright' | 'other'
  description: String,        // optional details, max 500 chars
  
  // Review
  status: String,             // 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  reviewedBy: String,         // 'auto' | admin userId
  reviewedAt: Date,
  actionTaken: String,        // 'none' | 'removed' | 'warned' | 'shadow_banned' | 'banned'
  
  createdAt: Date
}

// INDEXES
// { status: 1, createdAt: 1 }            pending review queue
// { targetId: 1, targetType: 1 }         reports per content
// { targetUserId: 1 }                    reports per user
// { reporterId: 1 }                      reporter history
```

---

## Collection: `moderation_actions`

```javascript
{
  _id: ObjectId,
  
  // Target
  targetType: String,         // 'post' | 'user' | 'comment'
  targetId: ObjectId,
  targetUserId: ObjectId,
  
  // Action
  action: String,             // 'approve' | 'reject' | 'shadow_ban' | 'ban' | 
                              // 'warn' | 'remove_content' | 'unban'
  reason: String,
  
  // Source
  source: String,             // 'auto_nsfw' | 'auto_toxicity' | 'manual_review' | 
                              // 'report_threshold' | 'appeal_review'
  performedBy: String,        // 'system' | admin userId
  
  // Appeal
  appealable: Boolean,
  appealId: ObjectId,         // ref: appeals
  
  createdAt: Date
}

// INDEXES
// { targetUserId: 1, createdAt: -1 }
// { targetId: 1, targetType: 1 }
// { source: 1 }
```

---

## Collection: `appeals`

```javascript
{
  _id: ObjectId,
  
  userId: ObjectId,
  moderationActionId: ObjectId,
  
  // Appeal
  reason: String,             // user's appeal text, max 1000 chars
  status: String,             // 'pending' | 'approved' | 'denied'
  
  // Review
  reviewedBy: String,
  reviewedAt: Date,
  reviewNotes: String,
  
  createdAt: Date
}

// INDEXES
// { userId: 1, createdAt: -1 }
// { status: 1, createdAt: 1 }
```

---

## Collection: `notifications`

```javascript
{
  _id: ObjectId,
  
  userId: ObjectId,           // recipient
  
  type: String,               // 'vote' | 'follow' | 'gem_earned' | 'trending' | 
                              // 'streak' | 'referral' | 'moderation' | 'system'
  
  // Content
  title: String,
  body: String,
  imageUrl: String,           // thumbnail
  
  // Action
  actionType: String,         // 'open_post' | 'open_profile' | 'open_screen'
  actionPayload: Object,      // { postId, userId, screen, etc. }
  
  // State
  read: Boolean,
  readAt: Date,
  
  // Aggregation (e.g., "5 people liked your post")
  aggregationKey: String,     // group similar notifications
  aggregationCount: Number,
  
  createdAt: Date
}

// INDEXES
// { userId: 1, read: 1, createdAt: -1 }   unread notifications
// { userId: 1, createdAt: -1 }             all notifications
// { aggregationKey: 1 }
// TTL: { createdAt: 1 }, expireAfterSeconds: 2592000 (30 days)
```

---

## Collection: `feature_flags`

```javascript
{
  _id: ObjectId,
  
  name: String,               // unique flag name
  description: String,
  
  // Rollout
  enabled: Boolean,           // global kill switch
  rolloutPercentage: Number,  // 0-100
  
  // Targeting
  targetTiers: [String],      // ['pro', 'premium'] or empty for all
  targetUserIds: [ObjectId],  // specific user overrides
  
  // A/B Test
  isExperiment: Boolean,
  variants: [{
    name: String,             // 'control' | 'variant_a' | 'variant_b'
    weight: Number,           // percentage allocation
    config: Object            // variant-specific config
  }],
  
  createdAt: Date,
  updatedAt: Date
}

// INDEXES
// { name: 1 }                unique
```

---

## Collection: `analytics_events`

```javascript
// NOTE: This collection is for hot buffer only.
// Events are batch-migrated to ClickHouse every 5 minutes.

{
  _id: ObjectId,
  
  // Event
  event: String,              // 'screen_view' | 'post_created' | 'vote_cast' | 
                              // 'gem_earned' | 'model_unlocked' | 'share' | etc.
  
  // Context
  userId: ObjectId,
  sessionId: String,
  deviceId: String,
  platform: String,           // 'ios' | 'android'
  appVersion: String,
  
  // Properties
  properties: Object,         // event-specific data
  
  // Attribution
  source: String,             // 'organic' | 'referral' | 'ad'
  campaign: String,
  
  timestamp: Date
}

// INDEXES
// { timestamp: -1 }
// TTL: { timestamp: 1 }, expireAfterSeconds: 86400 (24h — migrated to ClickHouse)
```

---

## Collection: `generation_jobs`

```javascript
{
  _id: ObjectId,
  
  userId: ObjectId,
  
  // Input
  prompt: String,
  refinedPrompt: String,
  model: String,
  priority: Number,           // higher = processed first (premium users)
  
  // Status
  status: String,             // 'queued' | 'processing' | 'completed' | 'failed'
  
  // Output
  imageUrl: String,
  thumbnailUrl: String,
  blurhash: String,
  generationTimeMs: Number,
  
  // Worker
  workerId: String,           // which GPU worker processed this
  attempts: Number,
  lastError: String,
  
  // Cost
  computeCostUsd: Number,     // actual cost for internal tracking
  
  createdAt: Date,
  startedAt: Date,
  completedAt: Date
}

// INDEXES
// { userId: 1, createdAt: -1 }
// { status: 1, priority: -1, createdAt: 1 }   job queue ordering
// { workerId: 1 }
// TTL: { completedAt: 1 }, expireAfterSeconds: 604800 (7 days)
```

---

## Redis Data Structures

```
# Session Management
session:{userId}              → JSON (JWT metadata, refresh token hash)
                                TTL: 7 days

# Rate Limiting
rate:vote:{userId}:{date}     → Counter
                                TTL: 24h
rate:gen:{userId}:{date}      → Counter  
                                TTL: 24h
rate:api:{ip}                 → Counter (sliding window)
                                TTL: 60s

# Feed Caching
feed:trending:{page}          → JSON (post IDs + scores)
                                TTL: 60s
feed:new:{page}               → JSON (post IDs)
                                TTL: 30s
feed:user:{userId}:{page}     → JSON (personalized feed post IDs)
                                TTL: 120s
feed:following:{userId}:{page} → JSON
                                TTL: 60s

# Real-time Counters
post:votes:{postId}           → Counter (real-time vote count)
                                TTL: 24h, then sync to MongoDB

# Leaderboards
leaderboard:daily             → Sorted Set (userId → score)
                                TTL: 24h
leaderboard:weekly            → Sorted Set
                                TTL: 7d
leaderboard:alltime           → Sorted Set
                                No TTL

# User State
user:online:{userId}          → "1"
                                TTL: 5min (heartbeat refresh)
user:streak:{userId}          → JSON (streak data)
                                TTL: 48h

# Feature Flags Cache
flags:all                     → JSON (all flags)
                                TTL: 60s
flags:user:{userId}           → JSON (resolved flags for user)
                                TTL: 300s

# Anti-Fraud
fraud:ip:{ipHash}:{date}      → Set of userIds
                                TTL: 24h
fraud:device:{deviceId}       → Set of userIds  
                                TTL: 30d
```

---

## ClickHouse Tables (Analytics)

```sql
-- Core event table
CREATE TABLE events (
    event_id        UUID,
    event_name      LowCardinality(String),
    user_id         String,
    session_id      String,
    device_id       String,
    platform        LowCardinality(String),
    app_version     String,
    properties      String,          -- JSON string
    source          LowCardinality(String),
    campaign        LowCardinality(String),
    timestamp       DateTime64(3),
    date            Date MATERIALIZED toDate(timestamp)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (event_name, date, user_id, timestamp);

-- Materialized view: DAU
CREATE MATERIALIZED VIEW dau_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY date
AS SELECT
    toDate(timestamp) as date,
    uniqState(user_id) as unique_users
FROM events
GROUP BY date;

-- Materialized view: Retention cohorts
CREATE MATERIALIZED VIEW retention_mv
ENGINE = AggregatingMergeTree()
ORDER BY (cohort_date, active_date)
AS SELECT
    toDate(min(timestamp)) OVER (PARTITION BY user_id) as cohort_date,
    toDate(timestamp) as active_date,
    user_id
FROM events
WHERE event_name = 'session_start';
```
