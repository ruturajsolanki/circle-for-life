# Circle for Life — System Architecture

> Create. Compete. Earn.
> A gamified AI social platform designed for viral growth, retention, and monetization.

---

## High-Level Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    React Native Application                          │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐              │   │
│  │  │  On-Device   │  │   UI Layer   │  │  Local Cache  │              │   │
│  │  │  LLM Engine  │  │  (Feed, Gen, │  │  (MMKV/SQLite)│              │   │
│  │  │  (ONNX/TFLi) │  │   Profile)   │  │               │              │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘              │   │
│  │         │                 │                   │                      │   │
│  │         │    ┌────────────┴───────────────┐   │                      │   │
│  │         └────┤     API Service Layer      ├───┘                      │   │
│  │              │  (Axios + Retry + Queue)   │                          │   │
│  │              └────────────┬───────────────┘                          │   │
│  └───────────────────────────┼──────────────────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
                         HTTPS / WSS
                               │
┌──────────────────────────────┼──────────────────────────────────────────────┐
│                        EDGE / CDN LAYER                                     │
│                                                                             │
│  ┌───────────────┐    ┌──────────────┐    ┌──────────────────┐             │
│  │  CloudFlare   │    │   AWS        │    │   Image CDN      │             │
│  │  WAF + DDos   │    │   CloudFront │    │   (CloudFlare R2  │             │
│  │  Protection   │    │              │    │    or S3+CF)      │             │
│  └───────┬───────┘    └──────┬───────┘    └────────┬─────────┘             │
└──────────┼───────────────────┼─────────────────────┼────────────────────────┘
           │                   │                     │
┌──────────┼───────────────────┼─────────────────────┼────────────────────────┐
│          │            API GATEWAY LAYER             │                        │
│          │                                          │                        │
│  ┌───────┴──────────────────────────────────────────┴──────────┐            │
│  │                    API Gateway (Kong / Traefik)              │            │
│  │                                                              │            │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐  │            │
│  │  │  Rate    │ │  Auth    │ │  Request  │ │  Load        │  │            │
│  │  │  Limiter │ │  Verify  │ │  Validate │ │  Balancer    │  │            │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────────┘  │            │
│  └─────────────────────────┬────────────────────────────────────┘            │
└────────────────────────────┼────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────────┐
│                     APPLICATION LAYER                                        │
│                                                                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐             │
│  │  Auth Service  │  │  Feed Service   │  │  Creation        │             │
│  │                │  │                 │  │  Service          │             │
│  │  - Register    │  │  - Infinite     │  │                  │             │
│  │  - Login       │  │    scroll       │  │  - Prompt        │             │
│  │  - JWT/Refresh │  │  - Trending     │  │    validation    │             │
│  │  - OAuth       │  │  - Following    │  │  - Cloud AI call │             │
│  │  - Device mgmt │  │  - Personalized │  │  - Watermark     │             │
│  └────────────────┘  └─────────────────┘  │  - Storage       │             │
│                                           └──────────────────┘             │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐             │
│  │  Voting        │  │  Gem Economy    │  │  Social          │             │
│  │  Service       │  │  Service        │  │  Service          │             │
│  │                │  │                 │  │                  │             │
│  │  - Cast vote   │  │  - Earn/spend   │  │  - Follow        │             │
│  │  - Anti-fraud  │  │  - Ledger       │  │  - Share         │             │
│  │  - Rankings    │  │  - Inflation    │  │  - Referral      │             │
│  │  - Caps        │  │    control      │  │  - Notifications │             │
│  └────────────────┘  └─────────────────┘  └──────────────────┘             │
│                                                                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐             │
│  │  Moderation    │  │  Analytics      │  │  Notification    │             │
│  │  Service       │  │  Service        │  │  Service          │             │
│  │                │  │                 │  │                  │             │
│  │  - NSFW detect │  │  - Event ingest │  │  - Push (FCM/APN)│             │
│  │  - Toxicity    │  │  - Metrics      │  │  - In-app        │             │
│  │  - Shadow ban  │  │  - A/B testing  │  │  - Email         │             │
│  │  - Appeals     │  │  - Feature flags│  │  - Real-time WS  │             │
│  └────────────────┘  └─────────────────┘  └──────────────────┘             │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────────┐
│                     WORKER / QUEUE LAYER                                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │                    BullMQ (Redis-backed)                      │           │
│  │                                                               │           │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  │           │
│  │  │  Image Gen   │  │  Moderation   │  │  Analytics        │  │           │
│  │  │  Queue       │  │  Queue        │  │  Event Queue      │  │           │
│  │  │              │  │               │  │                   │  │           │
│  │  │  Priority:   │  │  - NSFW scan  │  │  - Batch writes   │  │           │
│  │  │  Premium >   │  │  - Toxicity   │  │  - Aggregation    │  │           │
│  │  │  Free        │  │  - Hash match │  │                   │  │           │
│  │  └──────────────┘  └───────────────┘  └──────────────────┘  │           │
│  │                                                               │           │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  │           │
│  │  │  Notification│  │  Gem          │  │  Feed Ranking     │  │           │
│  │  │  Queue       │  │  Settlement   │  │  Recompute Queue  │  │           │
│  │  │              │  │  Queue        │  │                   │  │           │
│  │  └──────────────┘  └───────────────┘  └──────────────────┘  │           │
│  └──────────────────────────────────────────────────────────────┘           │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────────┐
│                     GPU WORKER LAYER                                         │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │              GPU Worker Pool (Autoscaling)                    │           │
│  │                                                               │           │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               │           │
│  │  │  Worker 1  │  │  Worker 2  │  │  Worker N  │               │           │
│  │  │  (Free)    │  │  (Premium) │  │  (Premium) │               │           │
│  │  │  SDXL-Lite │  │  Flux      │  │  MJ-API    │               │           │
│  │  └───────────┘  └───────────┘  └───────────┘               │           │
│  │                                                               │           │
│  │  Providers: RunPod Serverless / Replicate / Modal / BFL API  │           │
│  └──────────────────────────────────────────────────────────────┘           │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────────┐
│                     DATA LAYER                                               │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  MongoDB      │  │  Redis       │  │  S3 / R2     │  │  ClickHouse  │   │
│  │  Atlas        │  │  Cluster     │  │  Object      │  │  (Analytics) │   │
│  │              │  │              │  │  Storage     │  │              │   │
│  │  - Users     │  │  - Sessions  │  │  - Images    │  │  - Events    │   │
│  │  - Posts     │  │  - Feed cache│  │  - Avatars   │  │  - Metrics   │   │
│  │  - Votes     │  │  - Rankings  │  │  - Assets    │  │  - Funnels   │   │
│  │  - Gems      │  │  - Rate lim  │  │              │  │              │   │
│  │  - Moderation│  │  - Queues    │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Communication Patterns

```
┌──────────────────────────────────────────────────┐
│              COMMUNICATION PATTERNS               │
│                                                   │
│  Synchronous (REST/gRPC):                        │
│  ├── Client → API Gateway → Service              │
│  ├── Service → Service (internal gRPC)           │
│  └── Health checks                               │
│                                                   │
│  Asynchronous (Event-Driven):                    │
│  ├── BullMQ for job queues                       │
│  ├── Redis Pub/Sub for real-time events          │
│  └── WebSocket for client push                   │
│                                                   │
│  Data Flow:                                      │
│  ├── Write: Client → API → Service → DB + Queue  │
│  ├── Read:  Client → API → Cache → DB (fallback) │
│  └── Feed:  Client → API → Redis Cache → Mongo   │
└──────────────────────────────────────────────────┘
```

---

## Core Game Loop Flow

```
┌─────────┐    ┌───────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│  CREATE  │───▶│   POST    │───▶│   VOTE   │───▶│  EARN   │───▶│  UNLOCK  │
│         │    │           │    │          │    │  GEMS   │    │          │
│ - Prompt│    │ - Feed    │    │ - Likes  │    │         │    │ - Models │
│ - LLM   │    │ - Share   │    │ - Ranking│    │ - 10:1  │    │ - Features│
│ - GenAI │    │ - Caption │    │ - Trend  │    │ - Streak│    │ - Cosmetic│
└─────────┘    └───────────┘    └──────────┘    └─────────┘    └──────────┘
     ▲                                                              │
     │                                                              │
     └──────────────────────────────────────────────────────────────┘
                        RETENTION LOOP
```

---

## Technology Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile | React Native + Expo | Cross-platform, hot reload, large ecosystem |
| On-Device AI | ONNX Runtime / TFLite | Quantized LLM, zero server cost |
| API Gateway | Kong / Traefik | Rate limiting, auth, routing |
| Backend | Node.js + Fastify | High throughput, low latency, TypeScript |
| Job Queue | BullMQ + Redis | Reliable async processing |
| Primary DB | MongoDB Atlas | Flexible schema, horizontal scaling |
| Cache | Redis Cluster | Sub-ms reads, pub/sub, rate limiting |
| Object Storage | Cloudflare R2 | S3-compatible, zero egress fees |
| CDN | Cloudflare | Global edge, DDoS protection |
| Image Gen (Free) | SDXL-Turbo on RunPod Serverless | Pay-per-use, fast cold starts |
| Image Gen (Premium) | Flux / Midjourney API | High quality, tiered access |
| Analytics | ClickHouse | Columnar, fast aggregations |
| Monitoring | Grafana + Prometheus | Open-source observability |
| CI/CD | GitHub Actions | Cost-effective, integrated |
| Infrastructure | Docker + Kubernetes (EKS) | Auto-scaling, self-healing |

---

## Scaling Strategy

### Phase 1: 0–10K Users
- Single MongoDB replica set (Atlas M10)
- Single Redis instance
- 2 API pods
- RunPod Serverless for GPU
- Estimated cost: ~$200/mo

### Phase 2: 10K–100K Users
- MongoDB Atlas M30 with sharding prep
- Redis Cluster (3 nodes)
- 4–8 API pods with HPA
- Dedicated RunPod workers
- CDN caching for images
- Estimated cost: ~$1,500/mo

### Phase 3: 100K–1M Users
- MongoDB sharded cluster
- Redis Cluster (6 nodes)
- 16+ API pods
- Multiple GPU worker pools
- Multi-region CDN
- ClickHouse cluster for analytics
- Estimated cost: ~$8,000–15,000/mo

### Phase 4: 1M+ Users
- Global multi-region deployment
- Read replicas per region
- Edge compute for personalization
- Custom GPU infrastructure
- Estimated cost: scales with revenue
