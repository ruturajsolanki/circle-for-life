# Circle for Life — API Endpoint Design

> RESTful API with versioning, consistent error handling, and comprehensive documentation.

---

## API Conventions

- Base URL: `https://api.circleforlife.app/v1`
- Auth: Bearer JWT in `Authorization` header
- Content-Type: `application/json`
- Pagination: cursor-based (`?cursor=xxx&limit=20`)
- Rate limits returned in headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Error format: `{ error: { code: string, message: string, details?: any } }`

---

## Authentication & Identity

```
POST   /v1/auth/register
       Body: { username, email, password, referralCode? }
       Response: { user, tokens: { accessToken, refreshToken } }
       Rate: 5/hour per IP

POST   /v1/auth/login
       Body: { email, password, deviceId }
       Response: { user, tokens }
       Rate: 10/hour per IP

POST   /v1/auth/login/oauth
       Body: { provider, token, deviceId }
       Response: { user, tokens }

POST   /v1/auth/refresh
       Body: { refreshToken }
       Response: { accessToken, refreshToken }

POST   /v1/auth/logout
       Body: { refreshToken }
       Response: 204

POST   /v1/auth/forgot-password
       Body: { email }
       Response: 204 (always, to prevent enumeration)

POST   /v1/auth/reset-password
       Body: { token, newPassword }
       Response: 204

POST   /v1/auth/verify-email
       Body: { token }
       Response: 204

DELETE /v1/auth/account
       Response: 204 (schedules deletion in 30 days)
```

---

## User Profile

```
GET    /v1/users/me
       Response: { user (full profile with gems, streaks, etc.) }

PATCH  /v1/users/me
       Body: { displayName?, bio?, avatarUrl?, profileTheme?, notificationPreferences? }
       Response: { user }

GET    /v1/users/:userId
       Response: { user (public profile) }

GET    /v1/users/:userId/posts
       Query: ?cursor=&limit=20&sort=recent|top
       Response: { posts[], nextCursor }

GET    /v1/users/me/streak
       Response: { currentStreak, longestStreak, lastActiveDate, todayCheckedIn }

POST   /v1/users/me/daily-checkin
       Response: { gemsEarned, currentStreak, bonusGems? }
       Note: Idempotent — safe to call multiple times per day
```

---

## Content Creation

```
POST   /v1/generations/create
       Body: { 
         prompt: string,
         refinedPrompt?: string,    // from on-device LLM
         model: 'sdxl-turbo' | 'flux' | 'midjourney',
         params?: { steps?, cfgScale?, negativePrompt? }
       }
       Response: { jobId, status: 'queued', estimatedWaitMs }
       Rate: Free=10/day, Pro=50/day, Premium=unlimited
       Auth: Required
       Note: Returns immediately. Client polls for result.

GET    /v1/generations/:jobId
       Response: { 
         jobId, status, 
         imageUrl?, thumbnailUrl?, blurhash?,
         generationTimeMs?,
         estimatedWaitMs?    // if still queued
       }

GET    /v1/generations/history
       Query: ?cursor=&limit=20
       Response: { jobs[], nextCursor }
       Note: User's generation history

POST   /v1/generations/:jobId/retry
       Response: { jobId, status: 'queued' }
       Note: Retry failed generation
```

---

## Posts & Feed

```
POST   /v1/posts
       Body: { 
         generationJobId: string,
         caption?: string,          // optional text caption
         visibility: 'public' | 'followers' | 'private',
         tags?: string[]            // max 10
       }
       Response: { post }
       Note: Links a completed generation to the feed

GET    /v1/feed/trending
       Query: ?cursor=&limit=20&timeWindow=24h|7d|30d
       Response: { posts[], nextCursor }
       Cache: 60s

GET    /v1/feed/new
       Query: ?cursor=&limit=20
       Response: { posts[], nextCursor }
       Cache: 30s

GET    /v1/feed/following
       Query: ?cursor=&limit=20
       Response: { posts[], nextCursor }
       Auth: Required

GET    /v1/feed/personalized
       Query: ?cursor=&limit=20
       Response: { posts[], nextCursor }
       Auth: Required
       Note: ML-ranked feed based on user interests

GET    /v1/feed/category/:category
       Query: ?cursor=&limit=20
       Response: { posts[], nextCursor }

GET    /v1/posts/:postId
       Response: { post }

DELETE /v1/posts/:postId
       Response: 204
       Auth: Owner only

GET    /v1/posts/:postId/voters
       Query: ?cursor=&limit=20
       Response: { users[], nextCursor }

GET    /v1/search/posts
       Query: ?q=string&cursor=&limit=20
       Response: { posts[], nextCursor }
       Note: Full-text search on prompts and tags
```

---

## Voting

```
POST   /v1/posts/:postId/vote
       Response: { 
         success: true, 
         newVoteCount: number,
         dailyVotesRemaining: number 
       }
       Rate: 100 votes/day per user
       Auth: Required
       Anti-fraud: device fingerprint + IP + behavior scoring

DELETE /v1/posts/:postId/vote
       Response: { success: true, newVoteCount: number }
       Note: Undo vote within 5-minute window

GET    /v1/votes/daily-status
       Response: { 
         votesUsed: number, 
         votesRemaining: number, 
         resetsAt: ISO8601 
       }
```

---

## Gem Economy

```
GET    /v1/gems/balance
       Response: { 
         balance: number, 
         pendingEarnings: number,
         multiplier: number,
         multiplierExpiresAt?: ISO8601 
       }

GET    /v1/gems/transactions
       Query: ?cursor=&limit=20&type=earn|spend&source=
       Response: { transactions[], nextCursor, summary }

POST   /v1/gems/spend
       Body: { 
         productId: string,
         quantity?: number 
       }
       Response: { 
         transaction, 
         newBalance: number,
         unlockedItem?: object 
       }
       Note: Idempotent via client-generated idempotencyKey header

GET    /v1/gems/store
       Response: { 
         products: [{ 
           id, name, description, cost, category, 
           available: boolean, owned?: boolean 
         }] 
       }

GET    /v1/gems/leaderboard
       Query: ?period=daily|weekly|alltime&limit=50
       Response: { entries: [{ rank, userId, username, avatarUrl, score }] }
```

---

## Social

```
POST   /v1/users/:userId/follow
       Response: 204

DELETE /v1/users/:userId/follow
       Response: 204

GET    /v1/users/:userId/followers
       Query: ?cursor=&limit=20
       Response: { users[], nextCursor }

GET    /v1/users/:userId/following
       Query: ?cursor=&limit=20
       Response: { users[], nextCursor }

GET    /v1/notifications
       Query: ?cursor=&limit=20&unreadOnly=true
       Response: { notifications[], nextCursor, unreadCount }

POST   /v1/notifications/read
       Body: { notificationIds: string[] }
       Response: 204

POST   /v1/notifications/read-all
       Response: 204
```

---

## Sharing & Referrals

```
GET    /v1/referral/code
       Response: { referralCode, referralUrl, stats: { totalReferred, gemsEarned } }

POST   /v1/referral/validate
       Body: { referralCode }
       Response: { valid: boolean, referrerUsername? }
       Note: Called during signup flow

POST   /v1/share/post/:postId
       Body: { platform: 'instagram' | 'tiktok' | 'whatsapp' | 'twitter' | 'copy' }
       Response: { 
         shareUrl: string,
         caption: string,
         imageUrl: string    // watermarked version
       }
       Note: Tracks share event for analytics
```

---

## Moderation & Reporting

```
POST   /v1/reports
       Body: { 
         targetType: 'post' | 'user',
         targetId: string,
         reason: string,
         description?: string 
       }
       Response: { reportId }
       Rate: 10 reports/day per user

GET    /v1/appeals/mine
       Response: { appeals[] }

POST   /v1/appeals
       Body: { moderationActionId, reason }
       Response: { appealId, status: 'pending' }
       Rate: 1 appeal per action

--- ADMIN ENDPOINTS (requires admin role) ---

GET    /v1/admin/moderation/queue
       Query: ?status=pending&cursor=&limit=20
       Response: { items[], nextCursor }

POST   /v1/admin/moderation/:itemId/review
       Body: { action: 'approve' | 'reject' | 'warn' | 'ban', notes? }
       Response: { moderationAction }

GET    /v1/admin/reports
       Query: ?status=pending&cursor=&limit=20
       Response: { reports[], nextCursor }

POST   /v1/admin/users/:userId/shadow-ban
       Response: 204

POST   /v1/admin/users/:userId/ban
       Body: { reason, duration?: 'permanent' | '7d' | '30d' }
       Response: 204

DELETE /v1/admin/users/:userId/ban
       Response: 204
```

---

## Analytics & Feature Flags (Internal)

```
POST   /v1/events/track
       Body: { events: [{ event, properties, timestamp }] }
       Response: 204
       Note: Batch event ingestion from client

GET    /v1/flags
       Response: { flags: { [flagName]: { enabled, variant?, config? } } }
       Cache: 300s per user
       Note: Returns resolved feature flags for the authenticated user

--- ADMIN ---

GET    /v1/admin/analytics/dashboard
       Query: ?period=7d|30d|90d
       Response: { 
         dau, mau, retention: { d1, d7, d30 },
         gemCirculation, conversionRate, viralCoefficient,
         avgSessionTime
       }

GET    /v1/admin/flags
       Response: { flags[] }

POST   /v1/admin/flags
       Body: { name, description, enabled, rolloutPercentage, variants? }
       Response: { flag }

PATCH  /v1/admin/flags/:flagId
       Body: { enabled?, rolloutPercentage?, variants? }
       Response: { flag }
```

---

## Health & System

```
GET    /v1/health
       Response: { status: 'ok', version, uptime }
       Note: No auth required

GET    /v1/health/detailed
       Response: { mongo, redis, gpu_workers, queue_depth }
       Note: Admin only
```

---

## WebSocket Events

```
Connection: wss://api.circleforlife.app/v1/ws?token=JWT

Client → Server:
  { type: 'subscribe', channel: 'feed:trending' }
  { type: 'subscribe', channel: 'post:{postId}' }
  { type: 'unsubscribe', channel: '...' }
  { type: 'heartbeat' }

Server → Client:
  { type: 'vote_update', data: { postId, voteCount } }
  { type: 'notification', data: { notification } }
  { type: 'generation_complete', data: { jobId, imageUrl } }
  { type: 'gem_earned', data: { amount, newBalance } }
  { type: 'trending_update', data: { posts[] } }
```

---

## Error Codes

```
AUTH_001    Invalid credentials
AUTH_002    Token expired
AUTH_003    Account suspended
AUTH_004    Email not verified
AUTH_005    Account deletion pending

RATE_001   Rate limit exceeded
RATE_002   Daily vote limit reached
RATE_003   Daily generation limit reached

GEM_001    Insufficient gems
GEM_002    Product not available
GEM_003    Already owned

POST_001   Post not found
POST_002   Cannot vote on own post
POST_003   Already voted
POST_004   Post removed by moderation

USER_001   User not found
USER_002   Cannot follow yourself
USER_003   Username taken

GEN_001    Invalid model for tier
GEN_002    Generation failed
GEN_003    Queue full, try later

MOD_001    Content rejected by moderation
MOD_002    Appeal already submitted
MOD_003    Action not appealable

SYS_001    Internal server error
SYS_002    Service unavailable
SYS_003    Invalid request format
```
