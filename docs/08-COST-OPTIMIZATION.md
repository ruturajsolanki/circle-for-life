# Circle for Life — Cost Optimization Strategy

---

## Cost Structure Overview

| Category | Key Driver | Optimization |
|----------|-----------|-------------|
| GPU Compute | Image generation | Serverless, tiered models, caching |
| Storage | Generated images | Compression, CDN, lifecycle policies |
| Database | User/post data | Indexing, caching, TTLs |
| Bandwidth | Image delivery | CDN with zero-egress storage |
| Moderation APIs | Per-image/text scan | Batch processing, on-device pre-filter |
| On-Device AI | Prompt enhancement | Zero cost (runs on user's device) |

---

## GPU Compute Optimization

### Strategy 1: Serverless GPU (RunPod / Modal / Replicate)

```
Why: Pay-per-second billing. No idle cost.
     Cold start: 2-5s (acceptable for image gen)
     
Cost comparison:
  Dedicated A100 GPU:     ~$2.50/hour = $1,800/month (always on)
  RunPod Serverless:      ~$0.00035/second = only when generating
  
  At 10,000 generations/day:
    Dedicated: $1,800/mo (fixed)
    Serverless: $0.003/gen × 10,000 × 30 = $900/mo (variable)
    
  At 1,000 generations/day:
    Dedicated: $1,800/mo (wasted capacity)
    Serverless: $0.003/gen × 1,000 × 30 = $90/mo
```

### Strategy 2: Tiered Model Quality

```
Free tier:  SDXL-Turbo (2-step, ~$0.003/gen)
  - Fastest generation
  - Good quality for free tier
  - Lowest cost per image
  
Pro tier:   Flux Pro ($0.04/gen)
  - Premium quality
  - Users pay with gems (earned through engagement)
  - Revenue offset by increased engagement
  
Premium:    Midjourney-level ($0.08/gen)
  - Highest quality
  - Significant gem cost
  - Low volume, high margin
```

### Strategy 3: Generation Caching

```
Problem: Users often generate similar prompts.
Solution: Semantic prompt similarity cache.

Implementation:
  1. Hash prompt after normalization (lowercase, strip whitespace)
  2. If exact match exists in cache (<24h), serve cached image
  3. If semantic match (>0.95 similarity), suggest cached result
  
Expected cache hit rate: 5-15%
Savings at 100K users: ~$500-1,500/month on GPU alone
```

### Strategy 4: Queue Priority

```
Priority queue ensures:
  - Premium users get faster processing (better UX)
  - Free users wait slightly longer during peak
  - No GPU idle time (always processing next job)
  - Batch processing during off-peak hours
```

---

## Storage Optimization

### Zero-Egress CDN: Cloudflare R2

```
S3 (AWS):
  Storage: $0.023/GB/month
  Egress:  $0.09/GB (THIS IS THE KILLER)
  
  At 1M images (avg 500KB):
    Storage: 500GB × $0.023 = $11.50/mo
    Egress (10M views, avg 200KB): 2TB × $0.09 = $180/mo
    Total: ~$191.50/mo

R2 (Cloudflare):
  Storage: $0.015/GB/month
  Egress:  $0.00 (FREE!)
  
  At 1M images:
    Storage: 500GB × $0.015 = $7.50/mo
    Egress: $0.00
    Total: $7.50/mo
    
  SAVINGS: 96% cheaper for storage + delivery
```

### Image Compression Pipeline

```
Original generation: ~2-5MB (PNG)
After optimization:
  1. Convert to WebP: ~200-500KB (90% quality)
  2. Thumbnail (400px): ~20-50KB (JPEG 80%)
  3. Blurhash: ~50 bytes (inline in JSON)
  
Storage per image: ~250KB average (full) + ~35KB (thumb)
1M images: ~250GB + ~35GB = ~285GB total
R2 cost: ~$4.28/month
```

### Lifecycle Policies

```
Hot tier (< 7 days):    Full resolution + thumbnail
Warm tier (7-90 days):  Full resolution + thumbnail
Cold tier (> 90 days):  Thumbnail only, full on demand
Archive (> 1 year):     Thumbnail only, full deleted

This keeps storage costs flat as the platform grows.
```

---

## Database Optimization

### MongoDB Atlas Costs

```
Phase 1 (0-10K users):
  M10 cluster: $57/month
  Storage: included (10GB)
  
Phase 2 (10K-100K users):
  M30 cluster: $380/month
  Storage: ~50GB included
  
Phase 3 (100K-1M users):
  M50 cluster: $1,140/month
  Auto-scaling storage
```

### Optimization Techniques

```
1. Denormalization for Reads
   - User info on posts (username, avatar)
   - Vote counts on posts
   - Gem balance on users
   → Eliminates joins/lookups for hot paths

2. Compound Indexes on Query Patterns
   - { trendingScore: -1, createdAt: -1 } for trending feed
   - { userId: 1, createdAt: -1 } for user's posts
   → Eliminates collection scans

3. TTL Indexes for Auto-Cleanup
   - Votes: 90 days
   - Analytics events: 24 hours (migrated to ClickHouse)
   - Generation jobs: 7 days after completion
   - Notifications: 30 days
   → Keeps collections lean

4. Redis as Read Cache
   - Feed pages: 30-120s TTL
   - User sessions: 5min TTL
   - Vote counts: 24h TTL with real-time updates
   → Reduces MongoDB read load by 70-80%
```

---

## Bandwidth Optimization

```
1. CDN Caching
   - Images cached at edge (1 year cache, immutable)
   - Feed API responses cached at edge (30-60s)
   - Static assets cached at edge (1 month)
   
2. Image Lazy Loading
   - Blurhash placeholder → Thumbnail → Full resolution
   - Only load full resolution when user taps
   - Infinite scroll pre-fetches next 5 items

3. Response Compression
   - gzip/brotli on all API responses
   - JSON minification
   - Field selection (only return needed fields)

4. WebSocket vs Polling
   - Real-time updates via WebSocket (less overhead than polling)
   - Batched updates (1 message per second max)
```

---

## Total Cost Projections

### Phase 1: 0-10K Users (~$200/month)

| Item | Monthly Cost |
|------|-------------|
| MongoDB Atlas M10 | $57 |
| Redis (small) | $15 |
| RunPod Serverless (~1K gens/day) | $90 |
| Cloudflare R2 | $5 |
| Moderation APIs | $20 |
| Misc (domain, email) | $13 |
| **Total** | **~$200** |

### Phase 2: 10K-100K Users (~$1,500/month)

| Item | Monthly Cost |
|------|-------------|
| MongoDB Atlas M30 | $380 |
| Redis Cluster | $100 |
| RunPod Serverless (~10K gens/day) | $900 |
| Cloudflare R2 | $20 |
| Moderation APIs | $100 |
| Monitoring (Grafana Cloud) | $30 |
| **Total** | **~$1,530** |

### Phase 3: 100K-1M Users (~$10,000/month)

| Item | Monthly Cost |
|------|-------------|
| MongoDB Atlas M50 + sharding | $2,500 |
| Redis Cluster (6 nodes) | $500 |
| GPU Workers (mix serverless + reserved) | $4,000 |
| Cloudflare R2 + Workers | $100 |
| Moderation (APIs + humans) | $2,500 |
| ClickHouse (analytics) | $200 |
| Monitoring & logging | $200 |
| **Total** | **~$10,000** |

### Revenue Required to Break Even

```
At Phase 2 ($1,500/mo cost):
  Need 1,500 paying users at $1/mo, or
  300 paying users at $5/mo, or
  Ad revenue: 100K MAU × $0.02 CPM × 100 impressions = $200K/mo
  
At Phase 3 ($10,000/mo cost):
  Need 10,000 paying users at $1/mo, or
  2,000 paying users at $5/mo
  
Unit economics are favorable because:
  - On-device AI = $0 marginal cost
  - Free tier image gen = $0.003 per gen
  - Only premium features incur significant cost
  - Bandwidth is essentially free (R2)
```
