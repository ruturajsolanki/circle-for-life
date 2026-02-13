# Circle for Life — Anti-Cheat & Fraud Detection System

---

## Threat Model

| Threat | Risk Level | Impact |
|--------|-----------|--------|
| Vote manipulation (self-voting via alt accounts) | HIGH | Inflates gems, distorts feed |
| Bot accounts for mass voting | HIGH | Destroys economy and trust |
| Referral fraud (self-referral loops) | MEDIUM | Free gems, inflated growth metrics |
| Gem farming via automated content | MEDIUM | Drains economy |
| Account selling (farmed gem accounts) | LOW | Minor economy impact |
| Content scraping | LOW | IP theft |
| DDoS | LOW | Service disruption |

---

## Multi-Signal Fraud Scoring System

Every vote is scored in real-time using 7 independent signals.
Each signal returns 0.0 (clean) to 1.0 (definite fraud).
Signals are weighted and combined into a composite score.

### Signal 1: Voting Velocity (Weight: 0.20)

```
Measures: How fast is this user voting?

Metric: votes per minute and per hour
Limits: 5/min, 30/hour

Score calculation:
  minuteScore = min(1.0, votesThisMinute / 5)
  hourScore = min(1.0, votesThisHour / 30)
  velocityScore = max(minuteScore, hourScore)

Why: Humans don't vote at machine speed.
     Bots typically fire votes rapidly.
```

### Signal 2: IP Clustering (Weight: 0.20)

```
Measures: How many accounts are voting from this IP?

Tracked in: Redis SET per IP per day
Threshold: 3 unique users per IP per day

Score:
  1 user:  0.0 (normal)
  2-3:     0.3 (possible shared network)
  4+:      scales to 1.0

Why: Multiple accounts on same IP = likely alt accounts
     Allows for shared WiFi (3 users is reasonable)
```

### Signal 3: Device Clustering (Weight: 0.15)

```
Measures: How many accounts share this device fingerprint?

Tracked in: Redis SET per device, 30-day window
Threshold: 2 unique users per device

Score:
  1 user:  0.0
  2:       0.2 (could be family)
  3+:      0.5-1.0

Why: Device fingerprints are harder to forge than IPs.
     Multiple accounts per device = strong alt account signal.
```

### Signal 4: Reciprocal Voting (Weight: 0.15)

```
Measures: Do voter A and post author B vote for each other?

Detection: If A votes for B's post, check if B has voted
           for A's posts in the last 24 hours.

Score:
  0 reciprocal votes: 0.0
  1 reciprocal:       0.3 (could be coincidence)
  2-3 reciprocal:     0.6 (suspicious pattern)
  4+ reciprocal:      0.9 (vote ring detected)

Why: Legitimate users rarely have perfect reciprocal patterns.
     Vote rings are the most common manipulation tactic.
```

### Signal 5: Burst Detection (Weight: 0.10)

```
Measures: Is this post receiving votes unusually fast?

Tracked in: Redis counter per post per minute
Threshold: 10 votes per post per minute

Score:
  ≤3 votes/min:  0.0 (normal virality)
  4-10:          0.3 (could be legitimate trending)
  11+:           scales to 1.0

Why: Coordinated voting campaigns create unnatural bursts.
     Organic viral posts get votes gradually, not in spikes.
```

### Signal 6: Account Age (Weight: 0.10)

```
Measures: How old is the voting account?

Score:
  < 1 hour:     0.8
  < 24 hours:   decays linearly to 0.0
  ≥ 24 hours:   0.0

Why: Bot/alt accounts are typically fresh.
     Requiring age reduces the speed of vote manipulation.
```

### Signal 7: Behavioral Patterns (Weight: 0.10)

```
Measures: Does the voting pattern look human?

Detection: Analyze intervals between last 10 votes.
           Calculate coefficient of variation (CV).

Score:
  CV < 0.1 AND interval < 5s:   0.9 (machine-like regularity)
  CV < 0.2 AND interval < 10s:  0.5 (suspicious regularity)
  Otherwise:                      0.0 (human-like variance)

Why: Humans vote at irregular intervals.
     Bots vote at nearly constant intervals.
```

---

## Composite Score and Actions

```
compositeScore = Σ(signal_i × weight_i) for all 7 signals

Actions based on score:
  0.0 - 0.3:  Clean. Vote counts normally.
  0.3 - 0.7:  Suspicious. Vote counts but is logged for review.
  0.7 - 0.9:  Flagged. Vote is recorded but DOESN'T affect counts.
               User's trust score is penalized (-2 per flagged vote).
  0.9 - 1.0:  Rejected. Vote is silently discarded.
               User's trust score is penalized (-5).
```

---

## Trust Score System

Every user has a trust score: 0-100, starting at 50.

```
Score modifiers:
  Flagged vote:         -2
  Rejected vote:        -5
  Blocked prompt:       -10
  Report upheld:        -15
  Clean day (no flags): +1 (recovery)

Effects by trust score:
  50-100:  Normal operation
  20-49:   Votes still count but closer scrutiny
  10-19:   Votes don't count toward gems
  0-9:     Shadow ban candidate (manual review triggered)
```

---

## Shadow Banning

Shadow-banned users experience the app normally but:
- Their votes are accepted but don't increment post counters
- Their posts appear in their own feed but not in public feeds
- Their posts don't earn gems from votes
- They receive no notifications about trending/leaderboard

This is preferred over hard bans because:
1. User doesn't know they're banned → doesn't create new account
2. Reduces adversarial adaptation (attacker doesn't know detection works)
3. Can be reversed if false positive

---

## Referral Anti-Abuse

```
Validation checks for referral bonuses:
  1. Different device ID (not same phone)
  2. Different IP hash (not same network — with grace for VPN)
  3. Referred user must complete activation gate:
     - Create account
     - Generate at least 1 image
     - Wait 24 hours
  4. Maximum 50 referrals per user (lifetime cap)
  5. Referral chains limited to 1 level (no MLM)

Red flags:
  - Multiple referrals from same IP
  - Referred accounts that never engage after activation
  - Burst of referrals in short time
```

---

## Automated Detection Jobs

| Job | Frequency | Action |
|-----|-----------|--------|
| Trust score recovery | Daily | +1 for clean users |
| Suspicious account scan | Hourly | Flag high-fraud-ratio users |
| Vote ring detection | 6 hours | Identify reciprocal voting clusters |
| Device clustering scan | Daily | Flag multi-account devices |
| Economy anomaly detection | Hourly | Alert on unusual gem flows |
| Referral validation | Continuous | Validate referral chain integrity |
