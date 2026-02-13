# Circle for Life — Risk Analysis & Technical Debt Prevention

---

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| GPU provider outage | Medium | High | Multi-provider failover (RunPod + Replicate + BFL) |
| Vote manipulation at scale | High | High | 7-signal fraud scoring, shadow banning, daily caps |
| Gem economy inflation | Medium | High | Hourly inflation monitor, dynamic earn-rate adjustment |
| NSFW content leak | Medium | High | 5-stage moderation pipeline, pre-generation prompt filter |
| MongoDB outage | Low | Critical | Atlas managed HA, Redis cache fallback for reads |
| API key exposure | Low | Critical | Keys in env vars, never logged, rotation policy |
| App Store rejection | Medium | Medium | Pre-launch compliance review, no NSFW in screenshots |
| User data breach | Low | Critical | Encryption at rest, bcrypt passwords, JWT rotation |
| Referral fraud draining gems | Medium | Medium | Device + IP gating, activation requirements |
| Cold start latency (GPU) | High | Low | Serverless warm pools, queue smoothing |
| Viral growth exceeding capacity | Low | Medium | Auto-scaling, queue depth monitoring, degradation plan |
| Copyright claims on AI content | Medium | Medium | Terms of service, DMCA process, content flagging |
| Platform dependency (single cloud) | Low | Medium | S3-compatible storage, containerized workloads |
| Key team member departure | Medium | Medium | Documented architecture, clean codebase |
| Regulatory changes (AI content) | Medium | High | Moderation pipeline, content labeling, compliance team |

---

## Mitigation Strategies (Detailed)

### GPU Provider Failover

```
Primary:   RunPod Serverless (SDXL-Turbo, cheapest)
Secondary: Replicate (broad model support)
Tertiary:  BFL API (Flux-specific)
Fallback:  fal.ai (general purpose)

Failover logic:
  1. Try primary provider
  2. On timeout (30s) or 5xx error → retry once on primary
  3. On second failure → route to secondary
  4. Log provider failures, alert if > 10% failure rate
  
The Control Panel's multi-provider design naturally
supports this — same service layer, different endpoints.
```

### Database Resilience

```
MongoDB Atlas:
  - Automatic failover (replica set)
  - Point-in-time recovery (35 days)
  - Automated backups (daily)
  - Read preference: secondaryPreferred for feed reads

Redis:
  - Sentinel for HA in self-hosted
  - ElastiCache/Upstash for managed
  - Application gracefully degrades without Redis:
    → Feeds served from MongoDB (slower)
    → Rate limiting falls back to in-memory
    → Sessions served from MongoDB
```

### Graceful Degradation Plan

```
Level 0: Normal operation
Level 1: High load
  → Increase feed cache TTLs (60s → 300s)
  → Reduce personalized feed to trending
  → Queue depth throttling
Level 2: Partial outage
  → Serve cached feeds only
  → Disable image generation for free tier
  → Disable real-time features (WebSocket)
Level 3: Critical
  → Static "we're working on it" page
  → Queue all writes for replay
  → SMS alert to engineering
```

---

## Technical Debt Prevention Strategy

### Code Quality Gates

```
1. TypeScript strict mode everywhere (no `any` except explicit casts)
2. Zod validation on ALL API inputs (no unchecked request bodies)
3. ESLint + Prettier enforced via pre-commit hooks
4. Minimum 70% test coverage on services (gem, vote, antifraud)
5. PR reviews required — no direct merges to main
```

### Architecture Decisions Record (ADR)

```
Every significant architecture decision is documented:
  docs/adr/
    001-database-choice.md
    002-queue-system.md
    003-gpu-provider-strategy.md
    004-authentication-approach.md
    ...

Template:
  - Context: Why are we making this decision?
  - Decision: What did we choose?
  - Alternatives: What else did we consider?
  - Consequences: What are the tradeoffs?
```

### Dependency Management

```
Rules:
  1. Lock file committed (package-lock.json)
  2. Dependabot / Renovate enabled for security updates
  3. No dependencies over 2 years without maintenance
  4. Audit monthly: `npm audit`
  5. Major upgrades get their own PR + testing pass
  
High-risk dependencies:
  - mongoose: Core data layer — pin major version
  - fastify: Core server — pin major version
  - sharp: Native binary — test on all platforms before upgrade
  - bullmq: Queue system — critical path
```

### Database Migration Strategy

```
Phase 1 (0-100K): Schema changes via Mongoose schema updates
  - Add fields with defaults (non-breaking)
  - New indexes added incrementally
  - No formal migration tool needed

Phase 2 (100K-1M): Formal migration scripts
  - migrate-mongo or custom scripts
  - All migrations tested in staging first
  - Rollback scripts for every migration
  - Blue-green deployment for schema changes

Rules:
  - Never remove a field without 2 release deprecation
  - Never rename a field — add new, backfill, deprecate old
  - All indexes must be created in background
  - Large migrations run as batch jobs, not in-line
```

### Monitoring and Alerting

```
Metrics to track:
  - API response times (p50, p95, p99)
  - Error rates by endpoint
  - Queue depth and processing latency
  - GPU generation success rate
  - Database connection pool utilization
  - Redis memory usage
  - Gem economy metrics (emission, burn, velocity)
  
Alert thresholds:
  - p99 latency > 5s → warning
  - Error rate > 5% → critical
  - Queue depth > 1000 → warning
  - GPU failure rate > 10% → critical
  - Redis memory > 80% → warning
  - Gem inflation risk = high → warning
  
Stack:
  - Grafana + Prometheus (self-hosted, free)
  - Sentry for error tracking ($29/mo)
  - PagerDuty for on-call (free tier for small team)
```

### Performance Budget

```
API endpoints:
  - Feed (cached): < 50ms
  - Feed (uncached): < 200ms
  - Vote: < 100ms
  - Post creation: < 300ms
  - Auth: < 200ms
  
Image generation:
  - SDXL-Turbo: < 5s end-to-end
  - Flux: < 30s end-to-end
  - MJ-level: < 90s end-to-end

Mobile app:
  - Cold start: < 2s
  - Feed scroll: 60fps
  - Image load (thumbnail): < 500ms
  - Navigation transition: < 300ms
```

### Testing Strategy

```
Unit Tests (70% coverage target):
  - Gem economy calculations
  - Vote scoring / ranking
  - Anti-fraud signal functions
  - Moderation pipeline logic
  
Integration Tests:
  - Auth flow (register → login → refresh)
  - Generation flow (create → poll → complete)
  - Vote → gem settlement pipeline
  - Feed ranking correctness
  
Load Tests (before each major release):
  - Simulate 10K concurrent users
  - Feed endpoint under load
  - Vote burst handling
  - Queue depth under load
  
E2E Tests (mobile):
  - Onboarding flow
  - Create → Post → Vote loop
  - Gem earning and spending
  - Share flow
```

---

## Known Technical Debt (Day 1)

| Item | Severity | Plan |
|------|----------|------|
| No formal database migrations | Low | Add migrate-mongo at Phase 2 |
| Denormalized user data on posts can become stale | Low | Background job to refresh, acceptable lag |
| No automated E2E tests | Medium | Add Detox/Maestro by Month 3 |
| Control Panel proxies API keys through backend | Medium | Move to direct client calls with CORS in Phase 2 |
| Vote TTL (90-day expiry) loses historical data | Low | Archive to ClickHouse before expiry |
| No message queue dead letter queue | Medium | Add DLQ handling for BullMQ by Month 2 |
| Single-region deployment | Low | Multi-region by Phase 3 (100K+ users) |

---

## Security Checklist

- [x] Passwords hashed with bcrypt (12 rounds)
- [x] JWT with short access token lifetime (15min)
- [x] Refresh token rotation on use
- [x] Rate limiting on all endpoints (Redis-backed)
- [x] Input validation via Zod on every route
- [x] SQL/NoSQL injection prevention (Mongoose parameterized queries)
- [x] XSS prevention via response headers (Helmet)
- [x] CORS properly configured
- [x] API keys in environment variables, never in code
- [x] Sensitive fields excluded from JSON serialization
- [x] Soft delete for user data (GDPR compliance)
- [x] Request logging with PII redaction
- [ ] Penetration testing (schedule before launch)
- [ ] SOC 2 compliance review (Phase 3)
- [ ] GDPR data export endpoint (Phase 2)
