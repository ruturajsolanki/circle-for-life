# Circle for Life — Gem Economy Algorithm

> Complete specification for the virtual currency system powering the platform's game loop.

---

## Design Principles

1. **Earn-to-play, not pay-to-play** — Every feature is accessible via earned Gems
2. **Predictable earning** — Users must understand how they earn
3. **Meaningful spending** — Gems must unlock real value
4. **Anti-inflation** — System-wide emission controls prevent devaluation
5. **Anti-exploit** — Multiple layers of fraud prevention

---

## Earning Mechanics

### 1. Votes → Gems (Primary Source)

```
Formula: floor(valid_votes / 10) * multiplier = gems_earned

Where:
  valid_votes    = votes not flagged by anti-fraud
  multiplier     = 1.0 (default) or 2.0 (referral bonus active)

Daily Cap: 50 gems/day from votes per user
Processing: Batch settlement every 5 minutes via worker
```

**Why 10:1 ratio?**
- At 100 daily vote cap system-wide, a highly engaged post gets ~50-200 votes
- This yields 5-20 gems per popular post
- A single Flux generation costs 5 gems
- This means 1 popular post ≈ 1-4 premium generations
- Creates a fair exchange rate between creation and consumption

### 2. Daily Login Streak

```
Base:     5 gems per daily login
Streaks:  
  3-day:    +2 bonus  (7 total)
  7-day:    +5 bonus  (10 total)
  14-day:   +10 bonus (15 total)
  30-day:   +25 bonus (30 total)
  100-day:  +100 bonus (105 total)

Streak breaks on missed day. Only consecutive days count.
```

**Why these numbers?**
- 5 gems/day baseline = 1 Flux gen per day for consistent users
- Streak bonuses create powerful retention hooks (Duolingo-style)
- 100-day milestone creates aspirational goal

### 3. Referral Bonus

```
On successful referral:
  Referrer: +10 gems immediately
  Referrer: 2x multiplier activated for 24 hours
  Referred: Standard welcome flow (no bonus gems — anti-abuse)

Validation:
  - Referred user must complete registration
  - Referred user must generate at least 1 image (activation gate)
  - Different device ID required
  - Different IP address required
```

### 4. Trending Bonus

```
When a post enters the top 10 trending:
  Author: +10 gems
  
Idempotent: Only awards once per post per trending window
```

---

## Spending Mechanics

### Gem Store Products

| Product | Cost | Type | Duration |
|---------|------|------|----------|
| Flux Generation | 5 gems | Consumable | One-time |
| Midjourney Generation | 10 gems | Consumable | One-time |
| Ad-Free Pass | 20 gems | Time-limited | 24 hours |
| Profile Theme: Neon | 50 gems | Permanent | Forever |
| Profile Theme: Galaxy | 50 gems | Permanent | Forever |
| Profile Theme: Midnight | 50 gems | Permanent | Forever |
| Custom Frame: Gold | 100 gems | Permanent | Forever |
| Custom Frame: Diamond | 200 gems | Permanent | Forever |
| Gift Card Redemption | 500+ gems | Cashout | N/A |

### Pricing Strategy

```
Free user daily gem income (engaged):
  - Daily login: 5 gems
  - 1-2 popular posts: ~5-10 gems from votes
  - Total: ~10-15 gems/day

This means:
  - 1 Flux gen every day (free, if engaged)
  - 1 Midjourney gen every 1-2 days
  - Ad-free pass every 2 days
  - Profile theme in ~5 days
  - Gift card redemption in ~35-50 days of engagement

The key insight: The system rewards ENGAGEMENT, not spending.
The more you create and engage, the more you can do for free.
```

---

## Anti-Inflation System

### Supply Control

```
System-wide daily gem emission cap: 1,000,000 gems

If daily emission approaches cap:
  1. Reduce vote-to-gem ratio (10:1 → 15:1 → 20:1)
  2. Reduce daily login bonus
  3. Increase spending costs

This is calculated hourly by the economy health worker.
```

### Demand Sinks

```
Gem sinks (things that permanently remove gems from circulation):
  1. Premium model generations (primary sink)
  2. Cosmetic purchases (permanent sink)
  3. Gift card redemptions (hard exit from economy)
  4. Time-limited passes (recurring sink)

Healthy economy: Daily burn ≥ 50% of daily emission
Warning zone: Daily burn < 33% of daily emission
Critical: Daily burn < 20% of daily emission
```

### Velocity Monitoring

```
Velocity = (daily_earn + daily_spend) / total_circulation

Healthy: 0.05-0.15 (5-15% of supply changing hands daily)
Stagnant: < 0.02 (users hoarding, not spending)
Overheated: > 0.30 (possible exploit or system issue)
```

---

## Economic Balancing Levers

| Lever | Effect | When to Pull |
|-------|--------|-------------|
| Vote-to-gem ratio | Lower earning rate | Inflation > target |
| Daily earning cap | Hard limit on income | Exploit detected |
| Product pricing | Increase gem sink | Supply too high |
| New products | Create new sinks | Economy stabilizing |
| Streak bonuses | Increase retention | Retention dropping |
| Referral multiplier | Boost growth | Growth slowing |
| Login bonus | Baseline engagement | DAU dropping |

---

## Transaction Ledger

Every gem movement is recorded in `gem_transactions` with:
- Full audit trail (before/after balances)
- Idempotency keys (prevent double processing)
- Source tracking (which system created it)
- Reference linking (what triggered it)

This ledger is the **source of truth**. The user's `gemBalance` field
is a denormalized cache that can be recomputed from the ledger.

---

## Reconciliation

Daily reconciliation job:
1. Sum all transactions per user
2. Compare to stored `gemBalance`
3. Flag discrepancies
4. Auto-correct if < 5 gems difference
5. Alert admin if >= 5 gems difference
