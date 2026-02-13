# Circle for Life — Content Moderation Pipeline

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    5-STAGE PIPELINE                      │
│                                                          │
│  Stage 1          Stage 2          Stage 3              │
│  ON-DEVICE ─────▶ PROMPT  ─────▶ IMAGE    ────────┐    │
│  PRE-FILTER      ANALYSIS       ANALYSIS         │    │
│  (client)        (sync)         (async)          │    │
│                                                    │    │
│  Stage 4          Stage 5                          ▼    │
│  COMMUNITY  ────▶ HUMAN    ────▶ [FINAL DECISION]     │
│  REPORTING       REVIEW                                 │
│  (async)         (manual)                               │
└────────────────────────────────────────────────────────┘
```

---

## Stage 1: On-Device Pre-Filter (Client-Side)

**Runs locally on the user's device. Zero server cost.**

```
Checks:
  1. Local blocked word list (~500 words/phrases)
  2. Basic regex pattern matching
  3. Content length validation
  
Implementation:
  - Bundled word list in app binary (encrypted)
  - Updated via feature flag config
  - Blocks prompt submission if detected
  
False positive handling:
  - User can report false positives
  - Word list is reviewed monthly
  
Coverage: ~60% of obvious violations caught at this stage
```

---

## Stage 2: Prompt Analysis (Server-Side, Synchronous)

**Runs BEFORE GPU generation. Prevents wasted compute on banned content.**

```
Check 2a: Regex Pattern Matching
  - Hardcoded patterns for illegal content (CSAM, etc.)
  - Updated via deployment (not runtime)
  - Zero tolerance — immediate rejection + trust penalty (-10)

Check 2b: Google Perspective API (Toxicity)
  Attributes scored:
    - TOXICITY
    - SEVERE_TOXICITY
    - IDENTITY_ATTACK
    - THREAT
    - SEXUALLY_EXPLICIT
  
  Actions:
    Score ≥ 0.8:  Auto-reject, trust penalty (-5)
    Score 0.5-0.8: Flag for review, allow generation
    Score < 0.5:   Clean, proceed
  
  Cost: Free tier covers ~1M requests/month
  Latency: 50-200ms per request

Check 2c: User Trust Check
  - Users with trust < 10 are auto-flagged for review
  - Shadow-banned users can still generate but posts don't go public
```

---

## Stage 3: Image Analysis (Async, Post-Generation)

**Runs after image is generated. Async via moderation queue.**

```
Check 3a: NSFW Detection (Sightengine / AWS Rekognition)
  Models: nudity-2.1, offensive, gore
  
  Actions:
    Score ≥ 0.7:  Auto-reject, remove image, trust penalty (-5)
    Score 0.4-0.7: Queue for human review
    Score < 0.4:   Auto-approve
  
  Cost: ~$0.001-0.002 per image
  Latency: 500ms-2s per image

Check 3b: Perceptual Hash Matching
  - Hash every generated image (pHash)
  - Compare against database of known-bad images
  - Catches variations of previously removed content
  
  Implementation:
    - pHash + Hamming distance
    - Threshold: distance < 10 = match
    - Database grows from rejected images

Check 3c: AI-Based Categorization
  - Auto-tag images with categories
  - Helps feed algorithm and content discovery
  - Identifies edge cases for review
```

---

## Stage 4: Community Reporting (Async)

```
Report flow:
  1. User clicks "Report" on post or profile
  2. Selects reason:
     - NSFW content
     - Hate speech
     - Spam
     - Harassment
     - Impersonation
     - Copyright
     - Other (free text)
  3. Report is recorded with metadata
  4. Auto-actions triggered at thresholds:
  
  3 reports:  Post queued for manual review
  10 reports: Post auto-removed pending review
  20 reports on user: User shadow-banned pending review

Rate limiting:
  - Max 10 reports per user per day
  - Prevents report abuse/brigading
  
Reporter reputation:
  - Track report accuracy over time
  - Reporters with high accuracy get weighted reports
  - Reporters who spam false reports get de-weighted
```

---

## Stage 5: Human Review (Manual)

```
Admin Dashboard Features:
  1. Moderation Queue
     - Sorted by: oldest first (FIFO for fairness)
     - Filterable by: type, severity, category
     - Shows: original prompt, image, user history, reports
  
  2. Actions Available:
     - Approve: Content is clean, release to feed
     - Reject: Remove content, notification to user
     - Warn: Content removed + warning notification
     - Shadow Ban: User's content hidden from public
     - Ban: Account suspended (7d, 30d, permanent)
  
  3. Context Provided:
     - User's moderation history
     - Trust score
     - Report history
     - Previous violations
     - Auto-detection scores
  
  4. Appeal Flow:
     - Users can appeal once per action
     - Appeals are reviewed by a different moderator
     - Decision is final after appeal review
     - Appeal decisions feed back into auto-detection tuning

Staffing estimate:
  100K users: 1-2 part-time moderators
  1M users: 5-10 moderators + ML-assisted triage
```

---

## Ethical Guidelines

### What We Moderate

| Category | Policy | Detection |
|----------|--------|-----------|
| CSAM | Zero tolerance, report to NCMEC | Pattern matching + image analysis |
| Nudity/Porn | Not allowed | NSFW API |
| Gore/Violence | Not allowed | Image analysis |
| Hate speech | Not allowed | Toxicity API |
| Harassment | Not allowed | User reports + text analysis |
| Deepfakes of real people | Not allowed | Pattern matching |
| Spam | Limited visibility | Behavioral analysis |
| Copyright | Responded to DMCA | Manual review |
| Political content | Allowed with fact-check | Community reports |
| Artistic nudity | Context-dependent | Human review |

### What We DON'T Moderate

- Creative expression within guidelines
- Controversial but non-hateful opinions
- Satire and parody
- Political art
- Cultural content

### Transparency

- Users are notified when content is removed (with reason)
- Monthly transparency report on moderation actions
- Public moderation guidelines document
- Appeal process for all actions
- No secret blacklists (shadow banning is disclosed in appeal)

---

## Implementation Cost

| Service | Cost at 100K users | Cost at 1M users |
|---------|-------------------|-------------------|
| Perspective API | Free (<1M/mo) | ~$500/mo |
| Sightengine NSFW | ~$100/mo | ~$800/mo |
| Human moderators | ~$2,000/mo | ~$15,000/mo |
| **Total** | **~$2,100/mo** | **~$16,300/mo** |
