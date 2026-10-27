# 126: Discovery & recommendation intelligence — intent-aware candidate ranker, novelty injection & exploration exploration graph

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | XL (delivered as three slices, see *Delivery*) |
| Blocked by | 46 - Watch history engine · 58 - Modern browse layout · 65 - Playback telemetry · 100 - Home shelves with reasons · 104 - Channel page data · 122 - Linked content graph · 125 - User engagement & activity history engine |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD ADR-22 High-throughput reactions & caching](../SDD.md#adr-22--high-throughput-reaction-counters--probabilistic-cache-refresh-xfetch) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** (written by Gemini, let Claude verify)
> YouTube's recommendation system famously suffers from the "rabbit hole / echo chamber" trap: once a user clicks two videos on a topic, their entire home feed and "Up Next" sidebar collapse into near-identical recommendations, eliminating organic serendipity, topic exploration, and discovery of rising creators. Furthermore, current platforms treat search intent and browse recommendations as disconnected silos.
> In our current platform, [100](100-home-shelves-related-videos.md) introduced initial co-watch and category shelves, but recommendations remain statically ranked by raw view count and immediate channel proximity, without factoring in:
> 1. Long-term user topical affinity vs transient curiosity.
> 2. Search query intent signals (videos related to what the user actively searched for 30 minutes ago).
> 3. Intentional novelty & exploration injection: balancing exploitation (proven favorites) with exploration (fresh channels, trending niche tags, rising creators).
> 4. Negative feedback loops: "Don't recommend channel", "Not interested", and skip penalties (videos abandoned in < 15 seconds penalized in future rankings).
> This ticket builds an intent-aware, exploration-balanced recommendation engine that outperforms YouTube by providing transparent, tunable, and serendipitous discovery.

## What to build (written by Gemini, let Claude verify)

### 1. Vector & Topic Affinity Model (`@vp/domain` & `@vp/db`)
- **Table `user_interest_profiles`**:
  - `user_id` (UUID PK), `tag_affinities` (jsonb map of `tag -> weight`), `channel_affinities` (jsonb map of `channelId -> weight`), `category_weights` (jsonb map of `categoryId -> score`), `last_active_at` (timestamptz).
  - Calculated incrementally:
    - Watched > 80% = +5 weight to tags and channel.
    - Watched < 15s (quick bounce) = -3 penalty weight to tags.
    - Liked video = +10 weight.
    - Search query executed = +4 weight to matching keywords for 24 hours (temporal boost).
    - Time decay: exponential half-life decay of 14 days applied during background aggregation.
- **Table `user_recommendation_feedback`**:
  - `user_id`, `video_id`, `channel_id`, `type` (`not_interested | hide_channel | tell_us_why`), `created_at`.
  - Exclusions strictly enforced in SQL query generation: hidden channels and rejected videos are filtered out with zero chance of reappearing.

### 2. Multi-Candidate Generation & Serendipity Scoring (`@vp/core` & `@vp/adapters`)
- **Four Candidate Channels**:
  1. **Core Affinity (60% quota)**: High-affinity tags, subscribed channels, and co-watch vectors from recent history.
  2. **Recent Search Intent (15% quota)**: Channels and videos addressing recent unanswered search queries from [125](125-user-engagement-and-activity-history-engine.md).
  3. **Serendipity & Novelty Injection (15% quota)**: Rising videos from creators with < 10,000 subscribers with high retention ratios (> 60% completion rate from [65](65-first-party-video-playback-telemetry-analytics-beacon.md)), introducing fresh topics outside the user's top 3 categories.
  4. **Trending & Community Momentum (10% quota)**: High reaction momentum and fresh uploads from the past 48 hours.
- **Novelty Scoring Formula**:
  - `final_score = (relevance_score * 0.65) + (completion_rate_prior * 0.20) + (novelty_boost * 0.15) - penalty_score`
  - Prevents feed homogenization: consecutive videos on the same shelf never share the same channel, and a single category is capped at a maximum of 40% of the feed.

### 3. API & Transparent Tuning Controls (`@vp/api-contracts` & `apps/server/api`)
- **Endpoints**:
  - `GET /v1/home/personalized`: dynamic shelves with transparent reason tags (`"Because you searched for Kubernetes"`, `"Fresh topic: Machine Learning"`, `"Rising creator"`).
  - `POST /v1/me/recommendations/feedback`: submit `{ videoId, type: 'not_interested' | 'hide_channel' }`.
  - `GET /v1/me/recommendations/topics`: user-facing topic pills (`"All"`, `"Recently Searched"`, `"New to you"`, `"Deep Dive"`), allowing users to explicitly steer their algorithm in real time.
- **Probabilistic Cache with XFetch (`@vp/concurrency`)**:
  - User recommendations are cached in Redis for 10 minutes with probabilistic early recomputation (ADR-22 XFetch), ensuring zero cache-stampedes while updating dynamically after new watch events.

### 4. Frontend Experience & Algorithmic Controls (`apps/client/web`)
- **Interactive Topic Pill Bar**:
  - Render dynamic topic pills on `/`: includes `"New to you"` (100% novelty mode) and `"Based on recent searches"`.
- **Card Action Menu (`VideoCard.Menu`)**:
  - Add menu actions: `"Don't recommend channel"`, `"Not interested"`, and `"Why was this recommended?"`.
  - Clicking `"Why was this recommended?"` opens a subtle popover explaining the exact signal (e.g. *"Recommended because 82% of viewers who watched Video X also watched this, and you searched for 'Go concurrency' yesterday"*).
- **Undo Toast**:
  - When marking a video "Not interested", display an immediate Undo toast with one-tap reversal.

## Acceptance criteria (written by Gemini, let Claude verify)

- [ ] `user_interest_profiles` and feedback tables created with complete migration and indexing. (written by Gemini, let Claude verify)
- [ ] Watch time (> 80% vs < 15s) and search queries dynamically update user tag and channel affinities in background sweeps. (written by Gemini, let Claude verify)
- [ ] Recommendation candidate generation satisfies the 60/15/15/10 affinity-intent-novelty-trending balance, and no single category exceeds 40% of shelf items. (written by Gemini, let Claude verify)
- [ ] Hidden channels and "not interested" videos are filtered out with zero leakage in both home and "Up Next" feeds. (written by Gemini, let Claude verify)
- [ ] "Why was this recommended?" modal/popover renders true algorithmic attribution signals directly from API item metadata. (written by Gemini, let Claude verify)
- [ ] "New to you" topic filter successfully isolates videos outside the user's historical category cluster. (written by Gemini, let Claude verify)
- [ ] All algorithms implemented in `@vp/domain` with pure mathematical functions tested via Vitest property-based tests. (written by Gemini, let Claude verify)
- [ ] Dual-runtime compatibility: executes and passes under Node and Bun test suites. (written by Gemini, let Claude verify)
