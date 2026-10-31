# 137: CI and test environment stability, main and PRs green first time

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Priority | P0 (High - Frontier Precedence: the next ticket to pick up, before 131, 136 and every other front-end or feature ticket; the number is dependency order, not priority) |
| Size | L (1 stack, 3 slices) |
| Blocked by | None |
| Blocks | — |
| Spec | [docs/standards/testing.md](../standards/testing.md) - [docs/standards/git-workflow.md](../standards/git-workflow.md) - [.github/workflows/ci.yml](../../.github/workflows/ci.yml) - [ARCHITECTURE.md section 6](../../ARCHITECTURE.md#6-verification--enforcement) |

**Status:** ready

> [!IMPORTANT]
> **Frontier Priority Notice:** this ticket has P0 precedence over every feature and front-end ticket, 131 and 136
> included. It needs nothing from another ticket, so it can start today.

> **Why.** Over the last 200 CI runs main was green first time on **1 of 15** completed runs (6.7%) and a pull request on
> **46 of 142** (32.4%). One PR in eight needed a rerun of the same commit to pass (19 of 157 commits, 12.1%), and
> 27 of 543 unit-shard runs (5.0%) failed only because a 200 s wall-clock budget was missed by 1 to 52 s. Every red
> main costs the owner a "green main" PR (#276 is one) and every flaky PR costs a rerun that nobody records, so the
> loop that merges 20 tickets a day spends a measurable share of its time on CI, not on the product. 131 moves 270
> front-end files and 136 touches every page: both multiply the number of PRs in flight, and with them every race and
> flake below. The platform has to hold a steady green before either lands, which is why this ticket goes first.
> The causes are not one bug but a handful of small classes, each measured below; the fix for each is a rule, a ratchet or a
> committed number, so the rate stays up once it is up.

---

## Today (main 3ead86a6, 2026-10-31)

Measured from GitHub on 2026-10-31 with `gh run list --workflow ci.yml --limit 200` and `gh api
repos/szebest/taitube-platform/actions/runs/<id>/jobs?filter=all` for every run (all attempts), then the logs of all 183
failed job executions (`gh api .../actions/jobs/<id>/logs`), read and grouped by rule plus a manual read of every
group's first lines. The window is **2026-10-30 14:27 UTC to 2026-10-31 13:05 UTC**: 200 runs, 21 on main, 179 on
30 PR branches, 172 of them run once, 22 twice and 3 three times. "First time" means attempt 1 of a run that was not
cancelled or still running (concurrency cancelled 6 main and 34 PR runs, 3 PR runs were in progress). A wider list of
1000 runs (2026-09-26 to 2026-10-31) is used only where it says so, and only with the final conclusion of each run.

### 1. Green first time

| Branch | Runs | Cancelled | Green first time | Required five green first time (lint-typecheck, unit, unit-bun, integration, e2e-smoke) |
|---|---|---|---|---|
| main (push) | 21 | 6 (29%) | **1 of 15, 6.7%** | 12 of 15, 80.0% |
| PRs | 179 | 34 | **46 of 142, 32.4%** | 72 of 142, 50.7% |

The five required checks are green on main 80% of the time, so the red main is mostly the checks that are not
required: **visual** (non-required, in 12 of the 14 failed main runs) and **e2e-web**. The 1000-run list agrees: 45 of
66 conclusive main runs ended green (68.2%), 394 of 611 PR runs (64.5%), and 21 of 87 main runs (24%) were cancelled.
A PR first-run failure is sometimes the PR's own bug: the table cannot separate that from instability, which is why
tables 4 and 6 exist. `integration` and `e2e-smoke` never failed in the window.

### 2. Failures per job (attempt 1 of the 110 failed runs)

| Job | Failed job rows | Share of the 177 root rows | Failed runs containing it (of 110) |
|---|---|---|---|
| visual (10 shards) | 51 | 28.8% | 41 (37%) |
| lint-typecheck | 48 | 27.1% | 48 (44%) |
| unit-shard (6 shards) | 43 | 24.3% | 33 (30%) |
| e2e-web | 28 | 15.8% | 28 (25%) |
| build | 5 | 2.8% | 5 (5%) |
| unit-bun-shard | 1 | 0.6% | 1 (1%) |
| e2e-studio | 1 | 0.6% | 1 (1%) |
| unit (aggregate of the shards) | 36 | not counted, repeats a shard | 36 (33%) |
| unit-bun (aggregate) | 6 | not counted, repeats a shard | 6 (5%) |

The aggregates `unit` and `unit-bun` are red whenever any shard is (by construction, `ci.yml:191,246`), so they add 42
rows that carry no information of their own. Failed runs with a single failing root job: 22 only visual, 19 only
lint-typecheck, 13 only e2e-web, 9 only a unit shard, 5 only build.

### 3. The time budgets

The unit budget is `./.github/actions/budget` with `seconds: 200`, counted from the first step of the job to the budget
step, so checkout, workspace install, FFmpeg, kustomize, the turbo replay and fixtures count with the tests. Elapsed
seconds counted by the budget, per shard, over the 543 shard runs that reached the budget step:

| Shard | Runs | Min | Median | p90 | Max | Within 10% of 200 s (>= 180 s) | Over 200 s |
|---|---|---|---|---|---|---|---|
| 1 | 159 | 109 | 168 | 189 | 227 | 40 | 5 |
| 2 | 154 | 107 | 165 | 191 | 241 | 43 | 7 |
| 3 | 155 | 105 | 162 | 194 | 252 | 53 | 9 |
| 4 | 57 | 104 | 164 | 199 | 220 | 20 | 5 |
| 5 (only the last 13 runs) | 13 | 108 | 129 | 168 | 171 | 0 | 0 |
| 6 (only the last 5 runs) | 5 | 138 | 156 | 163 | 167 | 0 | 0 |
| all | 543 | 104 | 164 | 193 | 252 | **156 (29%)** | **26 (4.8%)** |

At 15% (>= 170 s) it is about 42% of shard runs. 27 budget steps failed, 25 of them on a PR and 2 on main. Three facts
about them:

- **The tests were not the slow part of the failures.** The test step took 132 to 183 s in all 27 (median 160 s) and the
  steps before it 26 to 102 s (median 48 s); across all runs the setup before the test step is a median 30 s, p90 39 s
  and up to 99 s. A budget on the test step alone, at the same 200 s, would have passed all 27.
- **The shards are unbalanced.** In the four complete 6-shard runs the slowest test step was a median 137 s and the
  fastest 82 s (a gap of 54 s, at most 61 s); in the 40 complete 4-shard runs the gap was a median 45 s and at most 71 s.
  Perfectly balanced, 6 shards would run about 110 s each. The cause (hash split by file path, not cost) is not measured
  here, only the imbalance; the shards already restore `node_modules/.vite/vitest` for durations, which orders files
  within a shard and does not move a file between shards.
- **The shard count changed mid-window** (5 shards at 2026-10-31 11:14, 6 at 12:19), so shard 5 and 6 rows are small.

The other budgets (`timeout-minutes` in `ci.yml`, held by `tests/architecture/ci-shape.test.ts`), over successful job
runs in the window:

| Job | Runs | Median s | p90 s | Max s | Limit s | Runs >= 90% of limit | Runs >= 85% of limit |
|---|---|---|---|---|---|---|---|
| integration | 163 | 126 | 151 | **177** | 180 | **3** | **13** |
| lint-typecheck | 117 | 78 | 127 | 154 | 180 | 0 | 1 |
| unit-bun shards | 496 | 100 | 129 | 159 | 180 | 0 | 5 |
| e2e-smoke | 168 | 121 | 143 | 181 | 240 | 0 | 0 |
| e2e-web | 139 | 88 | 107 | 124 | 240 | 0 | 0 |
| e2e-studio | 170 | 67 | 81 | 170 | 240 | 0 | 0 |
| build | 205 | 42 | 74 | 102 | 120 | 0 | 1 |
| visual, PR runs | 1443 | 109 | 126 | 187 | 240 | 0 | 0 |
| visual, main runs | 130 | 164 | 185 | 199 | 240 | 0 | 0 |
| terraform | 173 | 11 | 15 | 58 | 120 | 0 | 0 |

`integration` sits at 177 s of 180 s in its worst run and has 13 runs inside 15%: it is the next job to start failing for
runner speed alone. The architecture suite has its own 12 s budget inside `lint-typecheck`: it failed once (run
41204016845, PR #273, **12219 ms with 618 of 618 tests passing**, confirmed in the log). Of the 28 logs that reached the
step (failed `lint-typecheck` jobs only, so a biased sample) the suite took 5.7 s to 12.2 s, median 10.0 s, and 10 of 28
(36%) were above 10.2 s, inside 15% of the budget. The step's wall time over all 152 runs that reached it is a median 11 s
and a p90 12 s, which includes the process start the budget does not count. No job ran into its `timeout-minutes`.

### 4. Flakiness proper: a failed run and a passed run of the same commit

A flip is a job that failed and, on the same head SHA, later passed (a rerun, or a second run of the commit).

| Job that flipped | Flips (SHA, job) | Share of the 23 root flips |
|---|---|---|
| visual (shards 7 and 10 mostly) | 9 | 39% |
| unit-shard (2 and 3 mostly) | 7 | 30% |
| e2e-web | 6 | 26% |
| lint-typecheck (the architecture budget) | 1 | 4% |
| unit and unit-bun aggregates | 6 | repeat the shards |

- **19 of 157 conclusive commits (12.1%) had a root flip**; 25 of the 200 runs (12.5%) are reruns, and 4 of those 25 still
  failed. 16 of the 19 are on PRs of three stacks (60, 72, 102), the busiest of the day.
- Flaky specs, by their failing test: `e2e/watch.test.ts:101` (theater mode, "the element has no box on the page": 14
  of the 30 e2e-web spec failures, last on 10-30 20:14, before #266 landed its fix), `e2e/shorts.test.ts:46` (arrow keys,
  expected `f002`, still on `f001`: 7), **`e2e/start-here.test.ts:6` (5, the last at 10-31 13:05, still failing)**,
  `e2e/security/xss.test.ts:58` (2), `e2e/shell.test.ts:122` (1), `e2e/clips.test.ts:6` (1); unit:
  `shell-rail.dom.test.tsx` (5 of the 8 unhandled-request failures); visual: `components-accountmenu--open` (7),
  `web-livechat--pinned` (6), `web-commentitem--skeleton` (5), `web-engagementbar--*` (11).
- **`start-here` on run 41204016845 flipped on the same SHA** (a90f761e, PR #273, which does not touch those files):
  attempt 1 failed `toContainText('Moved to position 2')` with the live region still reading "Picked up ... position 3 of 3",
  and `lint-typecheck` failed its architecture budget; attempt 2 passed both. Both are in the tables above.
- **Nothing retries today**: no `retries` in `tests/playwright/config.ts`, the workbench visual config or vitest, so
  every flake fails the run and waits for a person to click rerun.
- The count is a floor: a developer who pushes a new commit instead of rerunning hides the flake, and a flip needs a
  human to click.

### 5. Merge races: main red right after a merge although each PR was green alone

`main` is protected with **`strict: true`** (a PR must be up to date before it merges), five required contexts
(`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`), one approving review with stale-review dismissal,
**`enforce_admins: false`**, no linear-history rule and no merge queue (read with `gh api
repos/szebest/taitube-platform/branches/main/protection`). Each of the 21 squash merges was compared with its
parent: **6 landed on a base one commit behind main** (#254, #253, #265, #269, #275, #277), each about 15 s after the
merge before it, so the up-to-date requirement was bypassed (consistent with `enforce_admins: false`; who bypassed is
not visible without the audit log). 20 of the 21 PRs had a green last PR run; #274 (red, merged) did not.

| Merge | Count | Main run first time green | Main failed | Main cancelled |
|---|---|---|---|---|
| landed on a current main | 15 | 1 | 8 (visual only) | 6 |
| landed one commit behind | 6 | 0 | **6** | 0 |

The six behind-merges all failed on main, and none of those failures is a merge race in the strict sense (two PRs green
alone, red together):

| Merge | Main failure | Cause | A race? |
|---|---|---|---|
| #253 | unit-shard-2, visual | the 200 s budget | no |
| #265 | unit-shard-2 | the 200 s budget | no |
| #277 | e2e-web | `start-here`, a flake | no |
| #254, #269 | visual | missing baselines, pixel diffs | no, see table 6 |
| #275 | lint-typecheck (knip), visual | two unused exported types in `library/hooks/` that **#274's own PR run already failed on** | no: #274 was merged with its last PR run red (knip and a shard budget), and #275's run inherited it; #276 fixed it |

So the window holds **0 failures traced to the combination of two green PRs**, **6 of 21 merges (29%) that bypassed
`strict`**, and **1 merge of a red PR (#274)**. The suspected race exists as an open door and has not cost a run yet;
what the data shows instead is a structural gap between a PR and main: **11 of the 14 failed main runs failed on a
visual baseline that no PR run could see** (2 of 6 variants are shot on a PR, table 6), which behaves like a race:
every PR green alone, main red.

`cancel-in-progress` adds a second hole: the concurrency group is per ref, so a merge cancels the previous merge's run
on main (6 of 21 main runs in the window, 21 of 87 in the 1000), and **a commit whose run was cancelled was never fully
checked**; #274 is one. Knip, the architecture rules and the drizzle migration journal were the suspected race
victims: knip failed 28 job executions (27 on a PR, 1 on main, inherited from #274), the architecture rules 20 (all on a
PR) and the migration journal none.

### 6. Failure causes, from the logs of all 183 failed job executions

Grouped by the failing step and the lines of its log; no job was left unread (0 without a log). "Flipped" is the
number of those jobs that passed on the same SHA.

| Cause | Jobs | Share | PR / main | Flipped | What the log says |
|---|---|---|---|---|---|
| Visual pixel diff | 32 | 17.5% | 24 / 8 | 9 | 714 to 20018 differing pixels, the same count in two runs of one story (deterministic against its baseline, not a coin flip) for `livechat`, `linernotes`, `starthereshelf`, and 9 flips on the rest |
| e2e-web spec | 30 | 16.4% | 29 / 1 | 6 | theater mode (14), shorts arrow keys (7), start-here (5), xss (2), shell (1), clips (1), see table 4 |
| knip | 28 | 15.3% | 27 / 1 | 0 | `Unused exports`, `Unused files`, `Unused exported types` after a PR dropped a consumer |
| Time budget, unit shard | 25 | 13.7% | 23 / 2 | 6 | `unit took 205262 ms, over its 200 s budget`; five logs read: 201.1 to 224.9 s |
| Architecture rule | 20 | 10.9% | 20 / 0 | 1 | `file-ceiling` (400 lines), `no-module-state`, `catch-confinement`: a real rule, caught on the PR |
| Missing visual baseline | 19 | 10.4% | 8 / **11** | 0 | `A snapshot doesn't exist`, 28 shots in one job: `web-choicecards--*` at sand light, sand oled, nocturne dark, nocturne oled, the four variants a PR does not shoot |
| jsdom unhandled request | 8 | 4.4% | 8 / 0 | 1 | `UnhandledRequestError: No MSW handler answered: GET /v1/videos?limit=30`, 5 in `shell-rail.dom.test.tsx` |
| Unit assertion | 7 | 3.8% | 7 / 0 | 0 | `routeTree.gen.test.ts` (2), `security-headers`, `contract-drift`, three route specs: real regressions |
| Generated file missing | 3 | 1.6% | 3 / 0 | 0 | `ENOENT .../styles/generated/sets.css` read by `token-group-map.dom.test.tsx` |
| Stale committed route tree | 3 | 1.6% | 3 / 0 | 0 | `git diff --exit-code routeTree.gen.ts` in the build job |
| Build error in code | 2 | 1.1% | 2 / 0 | 0 | `TS1117 duplicate key` in `@vp/messages` |
| Fixture missing | 2 | 1.1% | 2 / 0 | 0 | `ENOENT tests/fixtures/s15.mp4`, e2e-web and e2e-studio of one run |
| Architecture budget | 1 | 0.5% | 1 / 0 | 0 | `test:architecture took 12219 ms, over its 12 s budget` |
| Native crash | 1 | 0.5% | 1 / 0 | 0 | unit shard exit code 132, no assertion failed |
| Bun assertion | 1 | 0.5% | 1 / 0 | 0 | one `expect(received).toEqual(expected)` |
| Visual, the stories-as-tests step | 1 | 0.5% | 1 / 0 | 0 | the a11y step of one visual shard |

Grouped as the owner's list of suspects:

| Suspect | Jobs | Verdict |
|---|---|---|
| Time budget | 26 (25 shard, 1 architecture) | **Confirmed**, 14.2% of failures, and avoidable |
| Missing visual baselines | 19 | **Confirmed**, 11 of the 14 failed main runs, 0 visible to a PR |
| Knip, lint or architecture rule after a merge | 48 (28 knip, 20 architecture), 1 on main | **Refuted as a merge effect**: they are caught on the PR; the 1 on main is #274 merged red |
| Stale lockfile or drizzle journal | 0 | **Refuted** in this window |
| e2e locator ambiguity | 3 | **Confirmed**, small: `xss.test.ts:58` on the 126 PR (a repeated video matched 3 links) and `clips.test.ts:6` (a toast title matched 2) |
| jsdom timeout under load | 0 timeouts, 8 unhandled requests | **Refuted as stated**; the real class is an unmocked request |
| Native crash | 1 | **Confirmed**, 0.5% |
| Cold build order | 0 in CI | **Refuted in CI**: `turbo.json` already makes `typecheck` depend on `^build`, and no CI log has `Cannot find module '@vp/...'`. The cold-worktree failure is local and was not reproduced here. 6 jobs fail on a missing generated file or a stale route tree instead |
| Visual timeout, element not found under load | 0 visual jobs | **Refuted** for visual; the same words are the e2e-web theater-mode spec (16 jobs) |
| Infrastructure (runner, network, registry) | 0 | **Refuted**: no ECONNRESET, shutdown, rate-limit or disk error in 183 logs |
| Shared migration numbers and barrels colliding | 0 | **Not seen** in this window |

### 7. What the hypotheses said, in one place

| Hypothesis | Data |
|---|---|
| The 200 s budget counts the whole job, setup 35 to 40 s | Setup before the test step is median 30 s, p90 39 s, max 99 s; **confirmed** |
| Shards ran at 194 to 219 s | They ran at 104 to 252 s, median 164 s, p90 193 s; the 194 to 219 s band is the failing tail |
| Vitest splits by file hash, not cost | The imbalance is **confirmed** (54 s gap, 137 s against 82 s); the mechanism is not measured here |
| A PR shoots 2 of 6 variants, main all 6 | **Confirmed in source** (`packages/client/workbench/visual/stories.ts:69-74`: sand dark and nocturne light on a PR) and in the logs (11 main runs, 0 PR run for the 4 other variants) |
| No merge queue, no up-to-date requirement | **Half refuted**: up-to-date is on (`strict: true`) and bypassed by 6 merges; there is no queue. 0 failures traced to two green PRs combined; 1 merge of a red PR |
| Aggregates are red whenever a shard is | **Confirmed**, 42 duplicate rows |
| An e2e spec broke on a repeated video and a strict locator | **Confirmed**, 2 jobs |
| One jsdom spec hit an unhandled request in CI only | It is 8 jobs over 4 specs, 5 of them one spec |
| Cold `Cannot find module '@vp/components'` | 0 in CI |
| V8 native crash, exit 132 | **Confirmed**, 1 |
| Visual timeouts under load | 0 |

### What I could not measure

- **One day, not a quiet week.** The 200-run window is 23 hours of unusually heavy merging (21 merges, three big stacks).
  The wider list has only each run's final conclusion, no jobs and no attempts.
- **PR failures that are the PR's own bug** cannot be told from instability except where a SHA flipped, so table 1 is a
  floor for stability and table 6 reads only the log, not the diff.
- **Flips are a floor**: a pushed fix hides a flake, and only a clicked rerun makes one.
- **Why the six merges bypassed `strict`** (an admin bypass is the only reading consistent with the settings, the audit
  log is not readable here), and **whether a merge queue exists for a user-owned repository**: GitHub documents queues
  for organization-owned repositories; not confirmed with an API call.
- **Runner speed against code growth**: a slower shard may be a slower runner or more tests; the data has no per-file time.
- **Per-file test cost and the sharding mechanism** (only the imbalance).
- **The 6-shard balance** rests on four complete runs.
- **The architecture suite's real time** comes from 28 logs of failed jobs and the step wall time of 152 runs.
- **The local side** (disk and colima headroom on the owner's machine, the cold-worktree typecheck failure) is invisible to
  GitHub: nothing is measured, so slice a3 measures first and sets thresholds from it.
- **The failures GitHub shows as `cancelled`** (50 PR and 6 main runs) were not read: cancelled by a newer push or merge.

### What exists already (reuse it, build nothing twice)

| Need | What main has |
|---|---|
| Timing statistics | `pnpm ci:timings` (`scripts/ci-timings.ts`): median, p90 and max per job and step over **successful** runs only, `--runs`, `--branch`; it cannot see a failure, a flip or a race, which is what this ticket measures |
| Budgets | `.github/actions/budget` (wall clock, `started-at` and optional `finished-at`), the `timeout-minutes` of every job held by `tests/architecture/ci-shape.test.ts` |
| Sharding | vitest `--shard=N/6`, bun `--shard=N/3`, workbench `--shard=N/10`, a restored `node_modules/.vite/vitest` per shard |
| Fixtures | `./.github/actions/video-fixtures` with a cache; `pnpm gen-video --check` |
| Specs | MSW with unhandled requests failing (`@vp/web-testing`), Playwright with `trace: 'retain-on-failure'`, `workers: 2` in CI, no retries |
| Build order | `turbo.json`: `build` and `typecheck` depend on `^build`; `//#typecheck:repo` declares no dependency |
| Changed-only visual on PRs | `VISUAL_CHANGED_FILES` and `pass-with-no-tests` in the visual job |

---

## What to build

One stack, three slices, planned here and again in the feature PR body: `feat/137-ci-stability` with
`slice/137a-measure-and-protect-main`, `slice/137b-budgets-shards-visual-retries` and
`slice/137c-deterministic-specs-and-local` ([git-workflow.md section 2](../standards/git-workflow.md)). The slices touch
different files (workflows and scripts, then config and the sequencer, then specs), so they stack without meeting.

**Order.** a1 first: it commits the measuring command that every later acceptance number comes from, and stops main
losing runs. b and c follow in order; nothing waits for another ticket.

### Options and the choice

| Area | Options | Choice and why |
|---|---|---|
| Merge races, bypassed merges and unchecked commits | (1) a merge queue: serialises and tests the merge result, but is likely unavailable on a user-owned repository and adds a queue wait per PR; (2) `enforce_admins: true` on the existing `strict`: closes the 6-in-21 bypass and the red merge at no CI cost, but removes the owner's override; (3) leave it | **(2) plus `cancel-in-progress` for pull requests only**, so every main commit gets a full run (21 of 87 main runs cancelled today). (1) only if the owner has an organisation (Open questions) |
| The unit budget | (1) keep the job wall clock and raise it; (2) budget the test step alone with a margin, and let `timeout-minutes` bound the setup; (3) both | **(2)**: setup is runner and cache luck (30 to 99 s) and the tests are the code's own cost; the job `timeout-minutes` stays the outer bound. Budget the test step at **200 s** and require no run within 15% (>= 170 s) |
| Shard balance | (1) more shards (cost grows, imbalance stays); (2) a committed timing file (`tests/timings/unit.json`, per spec file) and a vitest sequencer that assigns files to shards greedily by recorded cost; (3) restore timings from the cache only | **(2)**: a cache entry is evicted, a committed file is reviewable and deterministic; a spec with no entry gets the median; a weekly step regenerates it into a PR |
| Visual baselines | (1) a PR shoots all 6 variants of the stories it changed; (2) a bot job draws missing baselines and pushes them (needs a write token to the PR branch and LFS); (3) leave main as the only place | **(1)**: the job already shoots only changed stories, main's median is 164 s against 109 s on PRs and its worst 199 s of 240 s, so changed-only at 6 variants fits; (2) stays the fallback if (1) breaches the 15% margin |
| Flake policy | (1) retries everywhere; (2) none; (3) one retry in CI, always reported, a nightly repeat run, and a quarantine with an owner and an expiry | **(3)**: a retry that is counted keeps `main` usable and turns every pass-on-retry into a ticket; `retries: 1` under `CI` for Playwright and vitest, the JSON reporters feed `ci:health`, a spec that failed without a code change is a bug fixed or quarantined, never a rerun |
| Deterministic specs | per-spec fixes | fake timers or awaited state for the live regions (`start-here`, shorts, theater mode), a default MSW handler set in the render helper plus a failure that names the missing handler (`shell-rail`), unique seed data per feature, locators scoped to a card or a region |
| Turbo build order | add `dependsOn` to `//#typecheck:repo` | cheap and safe: `typecheck:repo` reads `dist/` of other packages; do it in c1 and prove it with a cold worktree (not reproduced in CI) |
| Visibility | (1) a committed report; (2) a job summary plus a JSON artifact from a scheduled workflow | **(2)**: `main` takes no direct push, so a committed report needs a bot PR for a number |
| Local side | a `pnpm doctor`-style preflight in the demo and `make` scripts | thresholds set from a measured `df` and `colima status`, see c3 |

### Stack A: `feat/137-ci-stability`

**Slice a1: measure, and stop main losing runs.**
1. `pnpm ci:health` (extends `scripts/ci-timings.ts`, one spec per source file): for a branch and a window of N runs it
   prints tables 1 to 5 of this ticket (green first time, failures per job, shard and job margins, flips, merge races),
   including failed jobs and every attempt; `--causes` reads the failed logs and groups them by the committed rule table
   (`scripts/ci-health/causes.ts`, a fixture log per cause proves each rule); `--json` for the workflow below.
2. `concurrency.cancel-in-progress: ${{ github.event_name == 'pull_request' }}`, so a main run is never cancelled.
3. `.github/workflows/ci-health.yml` (nightly and on demand): runs `pnpm ci:health --json` and writes the tables to the
   job summary and the JSON to an artifact; exits non-zero below the thresholds in the acceptance criteria and opens or
   updates one issue with the numbers (the only write it makes).
4. The baseline numbers of this ticket go into the PR description as the "before" column.

**Slice a2: budgets, balanced shards, visual variants, retries.**
1. The unit budget measures the `Run unit tests` step, 200 s; the architecture budget measures its own step with the
   margin raised so no run is within 15% (measured first: 12 s today, median 10.0 s, a budget of 15 s keeps 20%);
   `ci-shape.test.ts` holds the new rule (a budget names a step, and its limit is below its job's `timeout-minutes`).
2. `integration` gets its `timeout-minutes` raised to 4 and a budget on its test step, because 13 of 163 runs sit within
   15% of 3 minutes.
3. `tests/timings/unit.json` and a vitest `sequencer` that shards by recorded cost; `pnpm timings:update` regenerates it
   from a run; a spec with no entry takes the median; an architecture test fails a spec file the file does not list
   after 7 days (a ratchet, with a fixture).
4. The visual job shoots all 6 variants of the changed stories on a PR (`shotsFor`, `pullRequest` loses its 2-pair
   branch), and a guard fails a story with a missing baseline on the PR, not on main.
5. `retries: 1` under `CI` in `tests/playwright/config.ts`, the workbench visual config and the vitest base config, with
   the JSON reporters on; `ci:health` counts a pass-on-retry as a flake and lists the spec.
6. The aggregates `unit` and `unit-bun` print which shard failed, so one red row names its cause.
7. `enforce_admins: true` on `main` once a1 and a2 are green for a day (the owner's call, Open questions).

**Slice a3: deterministic specs, the nightly flake hunt, the quarantine and the local side.**
1. Fix the named flakes at the source: `start-here.test.ts:6` (wait for the live region's end state, not its first),
   `shorts.test.ts:46`, `watch.test.ts:101` (checked again, fixed by #266), `shell-rail.dom.test.tsx` and the three other
   unhandled-request specs (a default handler set in the one render helper, a message that names the handler), `xss.test.ts:58`
   and `clips.test.ts:6` (locators scoped to a card or a toast), `token-group-map.dom.test.tsx` (reads the generated
   sheet through the build, not a path), the `s15.mp4` fixture ordering in `video-fixtures`.
2. `.github/workflows/flake-hunt.yml` (nightly): runs every Playwright spec `--repeat-each 10` and the jsdom specs three
   times, and files or updates one issue per spec that failed at least once, titled with the spec and linking the run.
3. `tests/quarantine.json`: a quarantined spec has an `owner`, a `reason`, an `expires` date and a ticket; an
   architecture test fails an entry with no owner or one past its expiry, and a spec that fails in `flake-hunt` and is not
   listed (a fixture proves each).
4. `//#typecheck:repo` depends on `^build`, proved from a cold worktree (a fresh `git worktree add`, `pnpm install`,
   `pnpm typecheck`).
5. A local preflight in the demo and `make` scripts: fails with the numbers when free disk or the colima disk is below a
   threshold; thresholds are set from `df` and `colima status` measured at the start of the slice, and a spec feeds the
   check fixed numbers.
6. Docs: `docs/standards/testing.md` (the flake policy, the quarantine, the retry rule, the budget on a step),
   `docs/standards/git-workflow.md` (enforce admins, cancel only PR runs, the health workflow),
   [ARCHITECTURE.md section 6](../../ARCHITECTURE.md#6-verification--enforcement) (a row per new check).

---

## Acceptance criteria

Each is a number with a command, measured by `pnpm ci:health`, which is committed in a1, over the 50 completed runs
after the last slice merges (the ticket stays `in-progress` until then). The baseline is the "today" column.

- [ ] **1. Main green first time.** `pnpm ci:health --branch main --runs 50`: at least **95%** of runs green first time
      (today 1 of 15, 6.7%), the five required checks and visual and e2e together.
- [ ] **2. No unchecked commit.** 0 of the last 50 main runs cancelled (today 6 of 21, 21 of 87).
- [ ] **3. No bypassed merge.** `pnpm ci:health --merges`: 0 of the last 20 merges landed behind main or with a red last PR
      run (today 6 and 1 of 21), and 0 main failures traced to a merge (today 0 found, the script classifies each main failure
      against its PR's last run).
- [ ] **4. PR green first time.** `pnpm ci:health --branch pr --runs 100` prints the rate (today 32.4%) and the causes of
      each first-run failure: none is `budget`, `missing baseline`, `unhandled request`, `generated file missing` or
      `fixture missing` (today 26 + 19 + 8 + 3 + 2 of 183 failures, 32%).
- [ ] **5. Budget margin.** No unit shard run, `integration`, architecture suite, `lint-typecheck` or unit-bun shard
      within 15% of its limit over 50 runs (today 42% of unit shard runs at >= 170 s, 13 integration runs at >= 153 s,
      10 of 28 architecture runs at >= 10.2 s), and `ci-shape.test.ts` fails a budget with no step or a limit above its job's
      `timeout-minutes`.
- [ ] **6. Shard balance.** The slowest unit shard's test step is at most **1.2 times** the fastest, over 50 runs (today
      137 s against 82 s, 1.67), and `tests/timings/unit.json` lists every spec file.
- [ ] **7. Rerun flips.** Fewer than **2%** of commits with a root flip over 100 runs (today 19 of 157, 12.1%), and pass-on-retry
      is reported per spec in the job summary.
- [ ] **8. Visual.** 0 `A snapshot doesn't exist` failures on main or a PR over 50 runs (today 19 jobs, 11 main runs), the
      PR job shoots all 6 variants of the stories it changed, and no visual job runs within 15% of 240 s.
- [ ] **9. Flaky specs.** The nightly `flake-hunt` over 10 repeats finds 0 specs failing without a code change that are not
      in `tests/quarantine.json`; the quarantine has at most 5 entries, each with an owner and an expiry, none expired; the
      named specs (`start-here`, `shorts`, `watch` theater mode, `shell-rail`, `xss`, `clips`, `token-group-map`) pass 10 of 10.
- [ ] **10. Determinism, structurally.** The one render helper provides the default handlers for the unmocked routes and an
      unhandled request names its handler; the repeated-video locators are scoped (`rg 'locator\(.a\[href=' apps/client/*/e2e`
      finds none unscoped).
- [ ] **11. Visible.** `ci-health.yml` ran on the last 7 nights, each run's summary shows the green rate, the flip rate and
      the slowest margin, and fails below thresholds 1, 7 and 5.
- [ ] **12. Local.** The preflight exits non-zero with the measured numbers below the thresholds, a spec proves it with
      fixed inputs, and `make smoke-offline` and the demo script call it.
- [ ] **13. Cold typecheck.** From a fresh worktree, `pnpm install && pnpm typecheck` passes with no prior build.

## Out of scope

- Speeding the suites up beyond the margin (a faster `integration` or `e2e-smoke` has no failure to remove here); the
  Docker and cache work of the "zero-waste" rule stays where it is.
- Rewriting visual baselines for a design change (136 owns them).
- Replacing GitHub Actions, self-hosted runners or paid larger runners: every number here is on the free `ubuntu-latest`.
- The nightly `load-smoke` and `sync-tickets` workflows, and `images.yml`.
- Mutation or coverage targets (#275 measures coverage).
- Weakening a check to get green: knip, the architecture rules and the file ceiling stay as they are; a failure caught on a
  PR is the check doing its job.

## Testing plan

- **`scripts/ci-health`**: one spec per source file (Rule 12), table-driven (`it.each`) over fixture run lists for green
  first time, flips, merge races and shard margins, and one fixture log per cause rule; the numbers of this ticket's
  tables are the expected values of one fixture built from the saved window.
- **Architecture, each with a fixture proving it fires**: a budget names a step and sits below its job limit; a spec file
  missing from the timing file after 7 days; a quarantine entry with no owner or past its expiry; a story shot on a PR
  for fewer than all variants.
- **Sequencer**: a spec over a fixed timing file asserting every file lands in exactly one shard and the largest shard is
  within 1.2 times the smallest, for shard counts 4, 6 and 8.
- **Specs fixed**: each named spec run 10 times in a loop locally and `flake-hunt` once, the output in the PR; an unhandled
  request in the render helper fails with the handler's name.
- **Live**: a draft PR for each slice, its CI green first time, and a deliberately red PR (an unused export) proving knip
  still fails on a PR.
- **After the last merge**: `pnpm ci:health` over the 50 following runs pasted into the ticket, which then moves to `done`.

## Open questions

- **Owner decision: `enforce_admins: true`.** It closes the 6-in-21 bypass (a merge landing on a base one commit behind)
  and the merge of a red PR (#274), and costs the owner the ability to merge past a stale branch or a red non-required check. Recommended: yes, after a1 and
  a2 are green for a day. Not done by the ticket: it is a repository setting, set by the owner.
- **Owner decision: a merge queue.** It tests the merged result and removes the race in full, but GitHub offers it for
  organization-owned repositories and this one is user-owned. Recommended: not now; `enforce_admins` plus `strict` covers
  the open door, and the window shows no race it would have caught. Revisit if the repository moves to an organisation.
- **Owner decision: 131 and 136 blocked by 137.** Both are open and not edited here. Recommended: add `137` to the `Blocked
  by` of each, so the frontier cannot offer them before this lands.
- **Decided: one retry, always reported.** A retried pass is counted as a flake in `ci:health` and fails the nightly
  threshold, so the retry cannot hide a spec.
- **Decided: the unit budget is the test step at 200 s with a 15% margin**, the setup bounded by the job's
  `timeout-minutes`; no change to the number of shards.
- **Verify at the start of a2: why a PR shoots 2 variants.** `stories.ts:69-74` says it saves time; measure the visual job
  at 6 variants on three changed-story PRs, and fall back to the drawing bot if any run is within 15% of 240 s.
- **Verify at the start of a3: the thresholds of the local preflight** (free disk, colima disk, memory) from `df -h`,
  `colima status` and the run that failed on a full disk, before writing a number.
- **Verify at the start of a1: the six unread cancelled runs per day.** If `cancel-in-progress` on PRs hides a failure a
  later run does not repeat, the cause table says so; the 50 cancelled PR runs were not read.

## Definition of Done

- [ ] All acceptance criteria proved with the `pnpm ci:health` output in the ticket, 50 runs after the last slice merged.
- [ ] `docs/standards/testing.md`, `docs/standards/git-workflow.md` and [ARCHITECTURE.md section 6](../../ARCHITECTURE.md#6-verification--enforcement)
      updated for the flake policy, the quarantine, the budgets, the timing file and the health workflow.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
