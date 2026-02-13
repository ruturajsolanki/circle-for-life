# Circle for Life — Voting & Ranking Algorithm

---

## Voting System

### Rules
- 1 like = 1 vote (upvote-only system, no downvotes)
- Users cannot vote on their own posts
- Maximum 100 votes per user per day
- 5-minute undo window after voting
- Votes cannot be undone after gems are settled

### Anti-Fraud Layers
- Multi-signal fraud scoring (0.0 – 1.0)
- Flagged votes (score > 0.7) are recorded but don't affect counts
- Auto-rejected votes (score > 0.9) are silently discarded
- Shadow-banned users' votes are accepted but don't count

---

## Ranking Algorithms

### 1. Trending Feed — Time-Decayed Score (Hacker News Style)

```
trendingScore = (votes - 1) / (age_hours + 2) ^ gravity

Where:
  votes      = total valid vote count
  age_hours  = hours since post creation
  gravity    = 1.8 (tunable)

Properties:
  - New posts with early engagement rise fast
  - Posts naturally decay over time
  - A post needs continuous engagement to stay on top
  - Gravity of 1.8 means half-life ≈ 6 hours

Example at gravity = 1.8:
  Post with 100 votes at 1 hour old:  (99) / (3)^1.8 = 13.07
  Post with 100 votes at 6 hours old: (99) / (8)^1.8 = 2.37
  Post with 100 votes at 24 hours old: (99) / (26)^1.8 = 0.19
```

### 2. Hot Feed — Wilson Score Lower Bound

```
Given upvote-only system, we use a modified Wilson score
that treats "total impressions" as the denominator:

n = votes + (views * 0.01)    // views contribute slightly
p̂ = votes / max(n, 1)         // observed proportion

Wilson lower bound at 95% confidence (z = 1.96):

hotScore = (p̂ + z²/2n - z√((p̂(1-p̂) + z²/4n) / n)) / (1 + z²/n)

Properties:
  - Rewards posts with BOTH high engagement AND sufficient data
  - A post with 10/10 votes ranks LOWER than 100/120 votes
  - This prevents new posts with 1-2 votes from dominating
  - Naturally penalizes posts that get lots of views but few votes
```

### 3. Engagement Score — Weighted Composite

```
engagementScore = votes * 1.0 + views * 0.01 + shares * 3.0 + comments * 2.0

This is the "raw quality" score that feeds into other algorithms.
Not time-decayed — represents total lifetime engagement.
```

### 4. Personalized Feed — Multi-Signal Ranking

```
For each candidate post, compute:

personalScore = 
    0.3 * categoryMatch     // Does this match user's preferred categories?
  + 0.5 * followingBoost    // Is this from someone the user follows?
  + 0.2 * engagementNorm    // How engaged is the community?
  + freshnessBoost          // Bonus for recency

Where:
  categoryMatch = frequency[post.category] / totalVotedPosts
  followingBoost = 1.0 if user follows author, else 0.0
  engagementNorm = min(1.0, engagementScore / 100)
  freshnessBoost = max(0, 0.2 * (1 - ageHours / 48))

Diversity filter applied after scoring:
  - Max 3 posts per author
  - Max 5 posts per category
  This prevents feed monotony.
```

---

## Feed Types Summary

| Feed | Sort By | Cache TTL | Description |
|------|---------|-----------|-------------|
| Trending | trendingScore DESC | 60s | Time-decayed engagement |
| New | createdAt DESC | 30s | Chronological |
| Following | createdAt DESC | 60s | Posts from followed users |
| Personalized | personalScore DESC | 120s | ML-ranked for the user |
| Category | trendingScore DESC | 60s | Filtered by category |

---

## Score Recalculation

Scores are recalculated:
1. **On every vote** — immediate for the voted post
2. **Every 5 minutes** — batch recalculation for all recent posts (worker job)
3. **On demand** — when feed cache expires and is rebuilt

The batch recalculation ensures scores stay fresh even as time passes
(the trending score decays with time, so a post's score changes even without new votes).

---

## Redis Leaderboards

```
ZADD leaderboard:daily     {trendingScore} {postId}
ZADD leaderboard:weekly    {engagementScore} {postId}
ZADD leaderboard:alltime   {engagementScore} {postId}

Daily board expires at midnight UTC.
Weekly board expires at Monday midnight UTC.
All-time board has no expiry, pruned to top 10,000.
```

---

## View Counting

Views are tracked via the analytics event system:
1. Client sends `screen_view` event with `postId`
2. Events are batched and sent every 30 seconds
3. Server deduplicates by (userId, postId, 1h window)
4. View count is incremented in MongoDB periodically

This means view counts are eventually consistent (5-15 minute lag),
which is acceptable for ranking purposes and prevents gaming.
