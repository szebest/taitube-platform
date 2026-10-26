# 112: Upload screening - local duplicate, content-safety and rule checks that hold a video for review

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 12 - Ladder flows fan-out and fan-in · 17 - Housekeeping · 26 - KEDA autoscaling · 30 - Transactional outbox · 39 - Declarative RBAC & ABAC · 44 - Creator studio video management · 60 - Creator studio dashboard · 61 - Administrator control panel · 98 - Realtime user event stream · 99 - Notifications · 103 - Comment reports and the moderation queue · 111 - Captions and transcripts |
| Blocks | — |
| Spec | [PRD §6 Functional requirements](../PRD.md#6-functional-requirements) · [SDD P9 Local-first](../SDD.md#13-design-principles-used-to-break-ties-throughout) · [SDD §3.2 Processing pipeline](../SDD.md#32-processing-pipeline-fan-out--fan-in) · [SDD §3.5 State machine](../SDD.md#35-state-machine) · [SDD §7 Object storage layout](../SDD.md#7-object-storage-layout) · [SDD §9.3 Fan-out / fan-in](../SDD.md#93-fan-out--fan-in-with-flows) · [SDD §11 Security](../SDD.md#11-security) · [SDD ADR-18](../SDD.md#adr-18--error-taxonomy-decides-retry-policy) |

**Status:** blocked

> **Why.** Nothing screens an upload today. [44](44-creator-studio-video-management-visibility.md) lists automated
> copyright scanning as out of scope, and moderation is manual afterwards: an admin takedown (`moderate Video`, one CAS to
> `REJECTED`), the admin panel ([61](61-admin-control-panel-category-moderation-ui.md)) and comment reports
> ([103](103-comment-hearts-reports-creator-inbox.md)). A re-upload of someone else's video, an explicit video or a page of
> spam goes public the moment `package` finishes, and a human finds it only if someone reports it.
>
> **Deliberately late.** This is among the last tickets in the dependency graph on purpose: it needs the moderation UI (61),
> the report patterns (103), notifications (99) and, for transcript screening, captions ([111](111-captions-and-transcripts.md)),
> and it blocks nothing. It is picked up only after the rest of the product is built.
>
> **What it is and is not.** A local first filter that sends the suspicious few to a human with evidence. It never deletes
> and never decides alone: the worst automatic outcome is a hold, and every hold can be appealed. It matches against the
> platform's own catalogue only, so it is a re-upload and plagiarism check inside Taitube, not a copyright clearance against
> the world's content (no external Content ID, nothing leaves the machine, [PRD G11](../PRD.md#3-goals--non-goals), SDD P9).

## Where the code lives

We write no C++ and add no folder beside `apps/` and `packages/`. `fpcalc` is a program the worker runs as a subprocess, as it
runs `ffmpeg`; the classifier is an ONNX model run by the `onnxruntime-node` npm package, which ships its own prebuilt
native library.

| What | Where |
|---|---|
| Fingerprinting and matching: frame sampling argv, dHash, band split, the `fpcalc` wrapper and Chromaprint parser, the offset-vote matcher, all pure apart from the subprocess | new server-tier package `packages/server/fingerprint` (`@vp/fingerprint`): `vp.layer` one above its highest dependency (it uses `@vp/ffmpeg`'s runner), `AGENTS.md`, `CLAUDE.md` symlink, entry in the root `AGENTS.md` index |
| Verdict and text rules: `decideScreening`, profanity, spam, blank-video rule | `packages/universal/domain-rules` (pure, input plus entity, returns findings), thresholds in `packages/server/env-schema/src/tuning.ts` |
| `FrameClassifier` port | `packages/server/core/ports` (abstract class, rule 4) |
| ONNX adapter and the in-memory double | `packages/server/adapters/onnx/` (the only importer of `onnxruntime-node`) and `packages/server/adapters/in-memory/`, selected in `registerAdapters` |
| Worker stage | `apps/server/worker/src/stages/screen/`, registered in `registry.ts` and `composition/stages.module.ts`; `package.ts` reads its result |
| Repositories | `packages/server/core/repositories` (interfaces), Postgres implementations in `packages/server/adapters/postgres/repositories/`, tables in `packages/server/db` |
| `fpcalc` in the image | `libchromaprint-tools` in the `worker` stage's `apt-get` line of the root `Dockerfile`, next to `ffmpeg`; `FPCALC_PATH` (default `fpcalc`) in the closed env schema for a run outside Docker |
| ONNX model and pins | fetched in the root `Dockerfile` build stage, URL and SHA-256 in `apps/server/worker/assets.lock` (the file 111 creates; whichever of the two tickets lands first creates it); `SCREENING_MODEL_PATH` for a run outside Docker, filled by `pnpm models:fetch` |
| Evidence and admin UI | `apps/client/studio` (admin area from 61 and the creator hold and appeal screens); keys in `packages/server/storage/src/keys.ts` |

Why a package for fingerprints but not for classification: the matcher and `fpcalc` wrapper are server logic with no port to
hide, while the model runner is an SDK and belongs behind a port in the adapters package.

## What to build

### 1. The `screen` stage

- **Placement.** A new queue `screen` and a Flow child of `package`, a sibling of the transcodes and the thumbnail
  ([12](12-ladder-flows-fanout-fanin.md), SDD §9.3). It reads the source only, so it runs in parallel with the transcodes
  and costs no extra latency while it stays under the 480p transcode time. A video is screened before it can go public,
  because `READY` (the master) is the moment it becomes watchable; a transcript is only available after `READY`, so text
  from 111 can raise a flag but not a hold (see 5).
- **Contract.** `ScreenJob` in `@vp/job-contracts` (`Base` plus `sourceKey` and `durationMs`), `ids.screen(videoId,
  generation)`, `QUEUES`, `stagePolicies.screen` (`attempts: 4`, exponential 10 s), `WorkerStageName`, `registry.ts`. It
  returns a `ScreenResult` that `package` reads like it reads `ThumbnailResult`.
- **Fencing.** The stage claims a `screen` step row with a lock token and commits fenced (rule 6); a re-run is idempotent
  because the result row is keyed by video and source checksum.
- **Retry classes (rule 7).** `PermanentError`: corrupt stream the probe let through, model checksum mismatch.
  `TransientError`: storage, database, queue, worker killed. When retries are exhausted the video is held with reason
  `SCREEN_ERROR` (fail closed): a broken model must not wave uploads through. `SCREENING_ENABLED=false` skips the child
  entirely.
- **Budgets.** Concurrency 2, CPU request 1 and limit 2, memory limit 1.5 GiB, a `ScaledObject` (min 0, max 4) on queue
  depth ([26](26-keda-autoscaling-graceful-shutdown.md)), a compose service, `make up worker:screen`. Target: a 10-minute
  1080p fixture screens in under 60 s on the reference worker. Metrics: `screen_seconds`, outcomes by reason, hold rate; an
  alert when the hold rate over 24 h exceeds a configured ceiling (a miscalibrated threshold floods the queue).

### 2. Duplicate and plagiarism detection (own catalogue)

- **Frames.** `ffmpeg` samples one frame every 2 s (`fps=1/2`, 9x8 greyscale), and the worker computes a 64-bit dHash per
  frame in plain TypeScript from the raw pixels: no native dependency, same result on Node and Bun. A 1 hour video is 1 800
  hashes (14 KiB).
- **Audio.** Chromaprint, through `ffmpeg`'s `chromaprint` muxer when the pinned build has it and the `fpcalc` binary
  otherwise (LGPL-2.1, run as a subprocess; the choice is checked with `ffmpeg -muxers` on the pinned image). The raw
  32-bit sub-fingerprints are stored per video.
- **Index in Postgres, no vector store.** Frame hashes go in `video_frame_hashes (video_id, idx, hash, b0..b3)` where `b0..b3`
  are the four 16-bit bands, each indexed: a frame within Hamming distance 3 shares at least one band exactly (pigeonhole),
  so the lookup is four index hits plus an exact distance check. Audio sub-fingerprints get the same inverted-index
  treatment over a subsample (every 4th term), sized in the criteria below.
- **Match.** Per candidate video the matched frame pairs vote on an offset (`j - i`); the biggest consistent offset bucket
  gives `coverage` (matched frames over the new video's frames) and `longestRunSeconds`. Audio gives a bit-error-rate over
  the aligned window. The similarity score is `max(videoCoverage, audioCoverage)`, with both kept as reasons.
- **Thresholds, in config** (`AppConfig.screening`, defaults in `tuning.ts`, not env keys, the schema is closed):
  `frameMaxHamming` 3, `duplicateCoverage` 0.9 (hold: a re-upload), `partialCoverage` 0.3 or `partialRunSeconds` 30 (flag, no
  hold: a partial copy), `audioMaxBitErrorRate` 0.35. A match whose original is in the same channel is advisory only
  (creators re-upload fixes). Fingerprints of `REJECTED` videos stay, so a re-upload of a taken-down video is a hold with a
  stronger reason; fingerprints of `DELETED` videos go with `purge-deleted`.
- **Known limits, stated in the ticket and the admin UI:** survives re-encoding, scaling, bitrate changes, trimming and
  small overlays; mirror is handled by also querying the flipped hash; heavy cropping, speed changes and re-recording a
  screen are not caught. A score is evidence for a person, never a verdict.

### 3. Content safety

- **Frames.** One frame every 10 s capped at 120, plus first, middle and last, decoded by `ffmpeg` and classified on CPU.
  A video's score is the maximum frame score and the share of frames over the threshold; a hold needs both a frame over
  `nsfwFrameThreshold` and a share over `nsfwShareThreshold`, so one odd frame does not hold a video.
- **Model.** A pinned ONNX image classifier run with `onnxruntime-node` (MIT) behind a `FrameClassifier` port with an
  in-memory double (rule 4), labels and per-label thresholds in config. Candidate: an Apache-2.0 NSFW image classifier
  exported to ONNX once, its SHA-256 in the same lock file as 111's model, copied into the image at build time and checked
  at start; no runtime download. The licence of the exact weights is re-read when the model is chosen.
- **Violence.** The port takes more labels, but v1 ships the NSFW label only unless a permissively licensed violence model
  passes the labelled-set check below (see Open questions).
- **Text.** Profanity and spam rules on title, description and tags, pure functions in `@vp/domain-rules` returning
  findings (profanity from a maintained word list per locale, link count, repeated terms, tag stuffing, all-caps ratio, the
  same title as the creator's recent uploads). They run in the stage, and again in the API when a creator edits those
  fields, where a hit raises a flag without changing the state.

### 4. Basic rules

- Size and duration caps already exist (`MAX_UPLOAD_BYTES`, `MAX_DURATION_SEC`, enforced at complete and probe); the stage
  does not re-check them. A corrupt or hostile file already fails the probe ([06](06-worker-runtime-probe-stage.md)).
- New: **blank or frozen video** (at least 95 percent of sampled frames within Hamming distance 2 and near-constant luma)
  and **metadata spam** from 3. Both are reasons with a score, held for review, not a rejection.

### 5. Outcome, hold, review and appeal

- **Verdict.** `decideScreening(findings, thresholds)` is a pure function returning `PASS` or `HOLD` with a score and an ordered
  list of reasons (`DUPLICATE`, `PARTIAL_MATCH`, `KNOWN_REJECTED`, `NSFW`, `BLANK`, `METADATA_SPAM`, `SCREEN_ERROR`), each with
  its evidence. A clear pass goes straight to `package` and `READY` with a stored `PASS` row. Flags (partial match, advisory
  metadata hits, transcript hits) never hold: they land in the queue and the video stays public.
- **State.** One new state, `HELD`, in SDD §3.5: `PROCESSING -> HELD` when `package` reads a `HOLD` result (the renditions
  exist, the master is not written, so nothing plays); `HELD -> PROCESSING` when a moderator approves (the `package` job is
  enqueued again, and the existing path writes the master and reaches `READY`); `HELD -> REJECTED` when a moderator rejects;
  `REJECTED -> HELD` when the creator appeals a screening rejection. Every transition is a compare-and-set that appends a
  `video_events` row in the same transaction (rule 6). The screening never rejects by itself and nothing is deleted.
- **Transcript text.** When 111 finishes, a `screen-text` pass over the transcript with the same profanity rules can raise
  a flag on the (already `READY`) video, never a hold. Without 111's rows the pass is a no-op.
- **Queue.** [61](61-admin-control-panel-category-moderation-ui.md)'s `/admin/moderation` gets a Held and flagged tab: score,
  reasons, the matched video (title, channel, thumbnail, overlapping time ranges), flagged frames and the metadata hits, with
  approve, reject (a reason is required) and dismiss for a flag. Evidence frames are small JPEGs under a private
  `evidence/{videoId}/` prefix that the raw bucket's 7 day lifecycle does not cover, removed 30 days after the case closes
  by housekeeping. Held and decided cases appear in the same table as comment reports.
- **Creator side.** Studio ([60](60-creator-studio-dashboard-video-management-ui.md)) shows a held video with a plain reason
  (never the matched video's identity, never the thresholds), an appeal form with a message, and the decision. The bell
  ([99](99-notifications.md)) and the user event stream ([98](98-realtime-user-event-stream.md)) tell the creator on hold,
  approval and rejection. An appeal puts the case back in the queue; a different moderator than the one who rejected decides.
- **Permissions** in `@vp/permissions`, declarative: `moderate Video` covers approve, reject and dismiss (one action, as in
  44); a new `appeal Video` for the owner on a `HELD` video or a screening rejection; the creator's field rule from 44
  (cannot edit visibility on a `REJECTED` video) is unchanged. No inline role or owner check.
- **Data.** `video_screenings` (video, source checksum, outcome, score, reasons as JSON, model and threshold versions, who
  decided), `video_frame_hashes`, `video_audio_fingerprints`, `screening_appeals`, with migrations and the in-memory doubles
  that `.clear()` their state.
- **Privacy.** Fingerprints are per video, derived data only, never shared between channels' views; classification runs on
  the worker with no network. Moderators see evidence; creators see a reason. A re-process (admin, SDD §3.5
  `FAILED -> PROBING`) reuses the stored result unless the source checksum changed, and a moderator-approved video is not
  held again.

## Acceptance criteria

- [ ] A fixture video uploaded twice by two channels: the second is `HELD` with reason `DUPLICATE`, a coverage of at least
      0.9, and the first video as evidence. A re-encoded copy (different bitrate and scale), a copy trimmed by 20 percent and
      a mirrored copy are all held; an unrelated fixture and a same-channel re-upload pass (the latter flagged, not held).
- [ ] A 35 percent excerpt of another video is flagged `PARTIAL_MATCH` and stays public; the flag appears in the queue with
      the overlapping ranges.
- [ ] A labelled evaluation set (committed or generated in the test, licence noted) gives the classifier at most 2 percent
      false positives on neutral frames at the default thresholds, and the explicit fixture is held. The numbers are in the PR.
- [ ] Blank, frozen, profane and spam-metadata fixtures are held or flagged with the matching reason; the caps are not
      re-implemented (a test asserts the stage reads no `MAX_*` value).
- [ ] The state machine is table-tested: `PROCESSING -> HELD`, approve, reject, appeal and every illegal edge, each writing a
      `video_events` row, a stale actor losing the CAS, and a stale worker fenced out of the `screen` step.
- [ ] A held video has no master and is not listable or watchable; approve makes it `READY`; reject keeps its fingerprints.
      The creator cannot appeal a manual takedown, and can appeal a screening rejection; a non-moderator calling approve or
      reject is `403` (`@vp/permissions` specs).
- [ ] The 10-minute 1080p fixture is screened in under 60 s, the audio index stays under 4 000 rows per hour of video and
      the lookup for the second upload against a catalogue of 10 000 fingerprinted videos is under 200 ms (measured, in the PR).
- [ ] `make smoke-offline` passes with the network disconnected and includes a screening step; the build fails on a model
      checksum mismatch; `onnxruntime-node` loads and runs under `vitest` and `bun test`; `local-first-check` passes.
- [ ] Studio and admin: a held case shows the creator reason and the appeal path; the moderation tab shows score, reasons,
      matched video and frames; approve, reject and dismiss work end to end.
- [ ] `pnpm typecheck`, `lint`, `knip`, `test`, `test:bun`, `test:architecture` green, with output in the PR.

## Delivery

One PR, committed in this order so each commit builds and passes on its own: (1) contracts, schema, thresholds, env keys and
the `HELD` state with its CAS transitions and permissions; (2) the pure rules and `decideScreening`; (3) frame and audio
fingerprints, the index and matching; (4) the classifier port, adapter, image build and lock file; (5) the `screen` stage,
queue, `package` integration, KEDA, compose and smoke step; (6) the admin moderation tab and Studio hold and appeal screens;
(7) SDD, README and ARCHITECTURE updates.

## Out of scope

- Matching against any catalogue outside the platform, an external Content ID, and any hosted moderation API.
- Automatic rejection or deletion, strikes and account penalties, and any scoring of creators or channels: a result is about
  one video and is decided by a person.
- Screening comments, live streams ([76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md)) and the video's audio content
  beyond the fingerprint and the transcript text.
- Re-screening the existing catalogue (a backfill job) and a threshold-tuning UI.

## Testing plan

- Unit: the dHash, band split and Hamming check; the offset-vote matcher over synthetic hash sequences (exact, shifted,
  partial, unrelated) as an `it.each`; every rule and `decideScreening` boundary; the state transitions.
- Contract: the fingerprint and screening repositories over the in-memory and Postgres adapters; the `FrameClassifier` port
  over its double and the ONNX adapter.
- Integration: the stage with real `ffmpeg` on the fixture set, the fake classifier for the pipeline path and one run of
  the real model; the admin and Studio flows through the suite's render helpers.

## Open questions

- Decided: screening is a Flow child of `package`, not a post-`READY` job like 111. A public video that is later pulled is
  the harm this ticket exists to avoid, and the stage reads only the source, so it overlaps the transcodes.
- Decided: a new `HELD` state instead of `REJECTED` plus an appeal for the automatic outcome. `REJECTED` is terminal in SDD
  §3.5 and means a human decided; `HELD` means nobody has yet, so approve is a normal transition and the appeal only exists
  after a person said no.
- Decided: fail closed. An exhausted retry holds the video with `SCREEN_ERROR` rather than letting it through; the kill switch
  `SCREENING_ENABLED` is the operator's way out.
- Decided: Postgres bands and an inverted index, no vector database or search cluster (SDD P8, P9). Revisit only if the
  lookup criterion is missed.
- Decided: thresholds are tuning constants in config, not env keys, because the schema is closed and an operator does not
  tune hash distances; the thresholds used are stored with each result so a change never rewrites history.
- Decided: a same-channel match is advisory and a match against a `REJECTED` video is stronger evidence. Creators fix and
  re-upload their own videos; a taken-down video coming back under another channel is the case worth a hold.
- Decided: screening does not store or show the matched video's identity to the creator, only to moderators, so the filter
  cannot be used to find who else uploaded something.
- Open: a violence classifier. No small, permissively licensed ONNX model is known to be good enough; v1 ships NSFW only
  unless one passes the evaluation criterion. The owner decides whether v1 ships without it.
- Open: `onnxruntime-node` under Bun 1.4 (rule 2 needs the stage on both runtimes). The fifth commit starts with a spike; if
  the addon does not load under Bun, the options are a subprocess inference binary or running `screen` from the Node worker
  image only, and the second needs the owner's call because it breaks parity for one stage.
- Open: where the converted ONNX model is hosted for the image build (upstream release asset if one exists, otherwise a
  release asset of this repository), recorded with its licence in the lock file.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `docs/SDD.md` (§3.5 state machine, §3.2, §5, §6.1, §7, §9.1, env and tuning tables), `README.md` and `ARCHITECTURE.md`
      updated; `.env.example`, compose and k8s base carry the new keys.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
