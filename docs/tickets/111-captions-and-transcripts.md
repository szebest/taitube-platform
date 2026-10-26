# 111: Captions and transcripts - local speech-to-text on its own queue, side-loaded WebVTT, creator and viewer controls

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 06 - Worker runtime + probe stage · 17 - Housekeeping · 26 - KEDA autoscaling · 30 - Transactional outbox · 44 - Creator studio video management · 47 - Multi-resource search engine · 57 - Production video player · 59 - Modern video watch page · 60 - Creator studio dashboard · 62 - Remove the legacy frontend · 72 - Settings · 97 - Account preferences API · 98 - Realtime user event stream · 107 - Chunked parallel transcoding |
| Blocks | 112, 116 |
| Spec | [PRD §6 Functional requirements](../PRD.md#6-functional-requirements) · [SDD P9 Local-first](../SDD.md#13-design-principles-used-to-break-ties-throughout) · [SDD §3.2 Processing pipeline](../SDD.md#32-processing-pipeline-fan-out--fan-in) · [SDD §3.3 Playback](../SDD.md#33-playback) · [SDD §7 Object storage layout](../SDD.md#7-object-storage-layout) · [SDD §9.1 Queue topology](../SDD.md#91-queue-topology) · [SDD §8.5 Chunked parallel transcoding](../SDD.md#85-chunked-parallel-transcoding-sources-over-5-minutes) · [SDD §9.7 Idempotency](../SDD.md#97-idempotency-guarantees-per-step) · [SDD ADR-18](../SDD.md#adr-18--error-taxonomy-decides-retry-policy) |

**Status:** blocked

> **Why.** Today a video has no captions and no transcript. [57](57-production-video-player-hls-streaming-controls.md)
> shows a captions toggle only when a track exists, and [72](72-frontend-settings-customization-system.md) and
> [97](97-account-preferences-api.md) already store `captionsOn` and `captionsLanguage`, but nothing produces a track and a
> creator has no switch. Captions are an accessibility feature first (a deaf or hard-of-hearing viewer cannot use a video
> without them) and a search feature second (the words spoken in a video become findable).
>
> **Deliberately late.** This is the lowest priority ticket in the graph: it blocks nothing, it needs the finished player,
> watch page, studio and settings area, and it adds a CPU-heavy stage nothing else depends on. It sits in the last level
> of the dependency graph on purpose and is picked up only after the rest of the product is built.
>
> **Independent of transcoding.** Captions are not part of packaging. The job starts at probe, runs on its own queue and
> pods beside the transcodes, lands whenever it lands (minutes after `READY` is fine), and reaches the player as side-loaded
> WebVTT. The video's state machine, its master playlist and its rendition pipeline never see them.
>
> **Local, as everything is.** Speech-to-text runs on the worker's CPU from a pinned model file baked into the image at
> build time. No transcription API, no key, no egress ([PRD G11](../PRD.md#3-goals--non-goals), SDD P9); `make smoke-offline`
> proves it.

## Where the code lives

We write no C++ and add no folder beside `apps/` and `packages/`. whisper.cpp is a third-party program the worker runs as a
subprocess, exactly as it runs `ffmpeg` today; `@vp/ffmpeg` is the model (`run-ffmpeg.ts`, `classify-ffmpeg-error.ts`,
`FFMPEG_PATH`).

| What | Where |
|---|---|
| TypeScript wrapper: argv builder, JSON output to cues, WebVTT writer, error classification | new server-tier package `packages/server/whisper` (`@vp/whisper`), with `package.json` `vp.layer` set one above its highest dependency (`pnpm boundaries` checks it), `AGENTS.md` and the `CLAUDE.md` symlink (`pnpm sync:claude`), and the package index in the root `AGENTS.md` |
| Worker stages | `apps/server/worker/src/stages/captions/` (`captions-chunk.ts` extracts audio and transcribes one window, `captions.ts` merges, writes the track and publishes the event), registered in `registry.ts` and `composition/stages.module.ts`; audio extraction goes through `@vp/ffmpeg` |
| Enqueue from probe | `apps/server/worker/src/stages/probe-enqueue.ts` (the outbox entry) and the window plan beside `chunkCountFor` in `packages/server/job-contracts/src/chunks.ts` |
| Keys | new key functions in `packages/server/storage/src/keys.ts`; `master.ts` in `@vp/ffmpeg` is not touched |
| Binary and model in the image | the `worker` stage of the root `Dockerfile` (ffmpeg comes from `apt-get` there today); a new `whisper-build` stage builds the pinned whisper.cpp tag with `cmake` and copies one `whisper-cli` binary into the worker stage, and a fetch step downloads the model |
| Pins | `apps/server/worker/assets.lock` (`KEY=value` lines: whisper.cpp tag, its source SHA-256, model URL and SHA-256, VAD model URL and SHA-256), read by the Dockerfile; Renovate does not touch it, a bump is a deliberate commit |
| Local runs | `make up` uses the same image, so compose has the binary and model. A run outside Docker finds them through `WHISPER_PATH` (default `whisper-cli`, on `PATH` like `FFMPEG_PATH`) and `CAPTIONS_MODEL_PATH`; `pnpm models:fetch` (a `tsx` script reading the same lock file, verifying the SHA-256, writing to a git-ignored `.models/`) fills the model |

Why a package and not a folder inside `@vp/ffmpeg`: whisper is a different program with its own failure classes and output
format, and `@vp/ffmpeg` already holds probe, transcode, thumbnail and master code under the 250-line file target. A
package keeps the argv and parser testable without ffmpeg, and the worker stage composes the two. whisper.cpp publishes no
Linux release binary, so the image builds the pinned tag from source in a throwaway stage; that is the only compiler
involved and nothing of ours is C++.

## What to build

### 1. Generation: its own queue, started by probe, in parallel with the transcodes

- **Trigger.** `probe` already knows the audio codec (`ProbeMetadata.audioCodec`). When it is set and captions are enabled for
  the video (see 3), `probe-enqueue.ts` adds one `captions` job through the outbox ([30](30-transactional-outbox.md)), in
  the same transaction as the `PROBING -> PROCESSING` transition. It is not a Flow child of `package`: `package` never
  lists it, `READY` never waits for it, and a captions failure never touches `videos.status` or `videos.version`. A source
  with no audio stream gets no job and a `disabled` row (`reason: NO_AUDIO`).
- **Engine.** `whisper.cpp` (MIT) run as a subprocess, as `ffmpeg` is, so worker code stays free of `Bun.*` and native
  addons and passes under Node and Bun alike (rule 2). The model is OpenAI Whisper `small`, multilingual, quantized
  (`ggml-small-q5_1.bin`, MIT), with Silero VAD (MIT) so silence is skipped, which also cuts hallucinated text over it. Binary
  and model are fetched in the worker image build, pinned by tag and SHA-256 in `apps/server/worker/assets.lock`, and checked
  at start; nothing is fetched at runtime. The tags are the current releases when the ticket is picked up (`npm view` /
  `gh release list`), never an old pin copied from this text.
- **Input.** Audio comes straight from the raw source: `ffmpeg` reads the presigned source URL with `-vn -ac 1 -ar 16000`
  into a scratch WAV (or a pipe into whisper), seeking with `-ss` before `-i` so a worker range-reads only its window, the
  way 107's chunk jobs read theirs ([SDD §8.5](../SDD.md#85-chunked-parallel-transcoding-sources-over-5-minutes)). There is no
  dependency on any rendition. Only a re-run after the raw source has expired (the 7 day lifecycle, SDD §7) falls back to
  the audio of a finished rendition; that path is the exception and is tested as such.
- **Parallel windows.** Sources over `CAPTIONS_CHUNKED.thresholdSeconds` (300, beside `CHUNKED_TRANSCODE` in
  `chunks.ts`) are split into fixed windows of `windowSeconds` (180). The plan is known at probe time, so the whole tree is one
  `FlowProducer.add` onto the `captions` queue only: a `captions` merge parent and one `captions-chunk` child per window.
  Each child transcribes its window plus a 5 s lead-in and tail and writes its cues as JSON to
  `tmp/captions/{videoId}/{modelVersion}/w{n}.json` in the raw bucket; a cue belongs to the window its start falls in, so the
  overlap yields no duplicates and no cut sentence. The parent reads the windows in order, offsets the times, writes the
  track, the cue rows and the status, and purges the tmp prefix. Shorter sources are one job with no children. Windows run
  in parallel across pods up to the queue's `maxReplicaCount`.
- **Language.** The creator's language hint when set, else each window auto-detects; the track's language is the majority by
  duration. A video that switches language mid-way gets the mixed result as spoken; per-segment language tracks are out of
  scope.
- **Idempotency and fencing.** Job ids are `ids.captions(videoId, modelVersion)` and `ids.captionsChunk(videoId,
  modelVersion, n)`: one track per (video, language, model version), so a retry, a re-enqueue from the reconciler or a
  replay overwrites identical keys and never duplicates. Each stage claims a step row (`captions`, rendition `w{n}` for a
  window, as `transcode-chunk` does) with a lock token and commits fenced; a stale worker is fenced out (rule 6). A new
  model version is a new job id, so upgrading the model re-captions only on request.
- **Retry classes (rule 7).** `PermanentError`: model file missing or checksum mismatch, whisper rejecting the input, no
  audio stream found at transcribe time (the row becomes `disabled`, the job succeeds). `TransientError`: storage, database
  or queue unavailable, whisper killed (OOM, `SIGKILL`) or timed out, a presigned URL that expired. `stagePolicies.captions`
  and `captions-chunk`: `attempts: 3`, exponential 30 s with jitter 0.5. A window that exhausts its attempts fails the
  merge parent, the row becomes `failed`, and the creator can retry from Studio; nothing else is affected.
- **Output.** The track is `videos/{videoId}/captions/{lang}/captions.vtt` (plain WebVTT, times on the media timeline), plus
  the cue rows for the transcript. Nothing is written under `hls/` and the master playlist is not rewritten.
- **Storage keys** (`packages/server/storage/src/keys.ts`, SDD §7): `captionsPrefix(videoId)`, `captionsFileKey(videoId, lang)`
  and `captionsChunkKey(videoId, modelVersion, n)` (tmp, raw bucket). Public bucket, `text/vtt`,
  `Cache-Control: public, max-age=60` (they are editable), CORS allowing the web origin.
- **Data.** `video_captions` (one row per video and language: `kind` `auto | edited | uploaded`, `status` `pending | ready |
  failed | disabled`, `language`, `detected_language`, `model_version`, `reason`, `version`) and `video_transcript_cues`
  (cue index, start and end ms, text, a `simple` `tsvector` with a GIN index, matching how search ranks text in SDD §5).
  Status changes are compare-and-set on the caption row and append a `video_events` row in the same transaction; the video
  row is not read or written.
- **Live to the player.** When the track is `ready` (and on `failed`), the merge stage publishes `captions.ready` /
  `captions.failed` on the user event stream ([98](98-realtime-user-event-stream.md)) with the video id and track, so an open
  watch page or Studio tab picks the track up without a reload.
- **Housekeeping.** `purge-deleted` removes the captions prefix, tmp prefix and rows; a `reconcile-captions` task re-enqueues
  enabled videos with audio, no `ready` row and a `pending` row older than one hour (ADR-16 idempotent enqueue plus
  reconciler).
- **Performance and isolation.** `captions` and `captions-chunk` share one queue at the lowest priority and are served by their
  own worker pods, never by the transcode pods: concurrency 1 per pod, `cpu` request 2 and limit 4, memory limit 2 GiB,
  `CAPTIONS_THREADS` equal to the CPU limit (as `FFMPEG_THREADS` is), whisper started under `nice -n 19`. A `ScaledObject`
  (min 0, max 4) on queue depth ([26](26-keda-autoscaling-graceful-shutdown.md), SDD §13.2), and a compose service with a
  `cpus` limit and `make up worker:captions`. Because the queue, the pods and the limits are separate, captions can queue
  behind nothing and starve nothing. Metrics: real-time factor, wall-clock from upload complete to `ready`, jobs by outcome,
  queue age; a dashboard row and an alert on queue age over 6 h.
- **Env.** `CAPTIONS_ENABLED` (platform kill switch, default `true`), `WHISPER_PATH`, `CAPTIONS_MODEL_PATH`,
  `CAPTIONS_THREADS`, declared in `@vp/env-schema`, `.env.example`, compose and the k8s base (`env-key-closure.test.ts`). No
  secret-shaped key.

### 2. Delivery: side-loaded WebVTT, not a master rewrite

- `GET /v1/videos/:id/captions` lists the tracks (language, kind, label, status, CDN `url` of the `.vtt`);
  `GET /v1/videos/:id/transcript?lang=&q=` returns cues, with `q` filtering through the `tsvector` (`websearch_to_tsquery`,
  the configuration search uses). Visibility follows the video: whoever may watch it may read its captions and transcript.
  The `.vtt` URL is the same class of public CDN object as the HLS segments, with the same unguessable id.
- Contracts in `@vp/api-contracts`, one source for the OpenAPI document (`pnpm gen:contracts`), SDD §6.1 updated.
- The player adds each track as a text track at runtime (see 4); the transcript panel reads the same cues.

### 3. Creator controls (Studio)

- **Switch.** `videos.autoCaptions` (`true | false | null`, `null` follows the channel) and `channels.autoCaptionsDefault`
  (default `false`: transcription costs CPU, so it is opt-in). One pure function decides when `probe` enqueues. Enabling it
  on an existing video enqueues the job immediately; the channel default applies to uploads from then on and does not
  backfill. Turning it off hides the track and keeps the row.
- **Studio video edit page** gets a Captions section: the switch, the track list with status (`pending`, `ready`, `failed`,
  `disabled`), the generated cues editable as text (timing stays as generated), replace with an uploaded `.vtt`, delete a
  track, retry and regenerate. It updates live from `captions.ready`. The channel default is a channel setting.
- **Upload and edit endpoints**: `PUT /v1/videos/:id/captions/:lang` (a `.vtt` body up to 1 MiB, parsed by a maintained
  WebVTT parser, never a regex stack; a malformed file is a `422` with the line), `PATCH` for cue text, `DELETE`, and
  `POST .../captions/generate`. An edited or uploaded track is never overwritten by regeneration unless the creator
  confirms. At most 10 tracks per video.
- **Permissions** in `@vp/permissions`: a `Caption` subject, `read` as the video's read rule, `manage` for the video's owner
  and `manage all`. No inline owner or role check anywhere.

### 4. Viewer controls (player and watch page)

- **Port.** `PlayerState` in `player-port.ts` gains `captionTracks`, `activeCaptionTrack`, `captionsEnabled` and the cues of
  the active track; `PlayerCommands` gains `selectCaptionTrack(id | null)` and `setCaptionTracks(tracks)`. The Video.js 10
  engine (`engine/video-js-engine.tsx`) adds the listed `.vtt` files as remote text tracks, so it works under MSE and native
  HLS alike; no skin imports the engine's types. The watch page calls `setCaptionTracks` from the captions query, which a
  `captions.ready` event invalidates.
- **Skin.** A CC button and a captions menu in `control-bar.tsx` / `settings-menu.tsx` (on or off, language, style), shown
  only when a track exists, and the `c` shortcut. Cues are drawn by an overlay from the port state, so size and background
  look the same in every browser.
- **Transcript panel** on the watch page ([59](59-video-watch-page-responsive-layout-enhancements.md)): the cues with the
  current one highlighted, click to seek, an in-video search box that calls the transcript endpoint.
- **Style and defaults.** `captionsSize` (choice) and `captionsBackground` (choice) join the playback section of the
  catalogue (`@vp/domain/settings`) beside `captionsOn` and `captionsLanguage`, so [97](97-account-preferences-api.md)
  validates and stores them with no new endpoint, and 72's accessibility page renders them. The player starts with the
  track picked in this order: the viewer's `captionsLanguage`, a browser language match, the video's detected language, and
  shows it when `captionsOn` is true.

## Acceptance criteria

- [ ] A fixture video with a known spoken clip (a short public-domain or CC0 recording committed with its licence note)
      gets a `ready` `video_captions` row with `detected_language` correct and a transcript whose word error rate against the
      known text is at most 0.25. A source without audio gets no job and a `disabled` row (`NO_AUDIO`).
- [ ] Independence, proved by test: `package` and `probe-enqueue` build the same flow with captions on and off (no captions
      node under `package`); `READY` is reached with the `captions` queue paused; a captions job that fails every attempt
      leaves `videos.status` and `videos.version` unchanged and the row `failed`; the master playlist bytes are identical with
      and without captions.
- [ ] Performance, measured and recorded in the PR: whisper's real-time factor on one pod at 4 threads is 1.0 or better; for a
      10-minute fixture the time from `complete` to a `ready` track is at most 6 minutes with 3 caption pods available and at
      most 12 minutes with one; and with captions running at full load the transcode p95 (job duration, `transcode-720p`) is
      within 5 percent of the same run with the `captions` queue paused (the isolation claim).
- [ ] A 12-minute fixture is split into windows, transcribed by parallel jobs, and merged: cue times are monotonic across
      window boundaries, no cue is duplicated or lost at an overlap (the merged transcript equals the single-job transcript
      except for at most 2 percent of words), and the cue offsets match the media in a browser test (within 100 ms).
- [ ] Idempotency: re-enqueueing the same (video, model version) and replaying a window leave one track and the same cue
      rows; a stale worker's commit is fenced out; killing whisper mid-window retries only that window and succeeds. A re-run
      after the raw source is deleted succeeds from a rendition's audio.
- [ ] `make smoke-offline` passes with the network disconnected and includes the captions step; the image build fails when the
      model's SHA-256 does not match the lock file; `local-first-check` passes (no new host, no runtime download).
- [ ] The enable decision is table-tested: video `true`, `false` and `null` against channel `true` and `false`; disabling a
      video with a `ready` track hides it and keeps the row.
- [ ] Live: with a watch page open on a `READY` video, `captions.ready` makes the CC button and the transcript panel appear
      without a reload (the playback does not restart).
- [ ] Studio: a creator enables captions on an existing video, sees `pending` become `ready`, edits a cue, uploads a replacement
      `.vtt` (a malformed file shows its line error), and a regenerate asks before overwriting an edited track.
- [ ] Player: captions toggle, language switch, the `c` shortcut, size and background from the saved preferences, and the
      transcript panel (highlight, click to seek, search) work; the toggle is absent when no track exists.
- [ ] A non-owner `PUT`, `PATCH` or `DELETE` on captions is `403`; a private video's transcript is `404` for others
      (`@vp/permissions` specs).
- [ ] `pnpm typecheck`, `lint`, `knip`, `test`, `test:bun`, `test:architecture` green, with output in the PR.

## Delivery

One PR, committed in this order so each commit builds and passes on its own: (1) contracts, keys, schema, env keys, the
window plan in `chunks.ts` and `@vp/whisper`; (2) the `captions-chunk` and merge stages, queue, KEDA and compose wiring, image
build and smoke step; (3) the `probe-enqueue.ts` outbox entry, the reconciler task and the isolation and performance
measurements; (4) caption and transcript API with permissions and the `captions.*` events; (5) catalogue additions and the
player port, skin and transcript panel; (6) Studio controls; (7) SDD, README and ARCHITECTURE updates.

## Out of scope

- Translating captions into other languages, and dubbing.
- Speaker labels, word-level timing and live captions for [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md).
- Platform-wide search over transcripts (the cues are indexed here and searched inside one video; wiring them into
  [47](47-multi-resource-search-engine.md) results is a follow-up).
- Timing edits in the Studio (upload a `.vtt` for that), and a hosted or GPU transcription path.
- Backfilling captions for every existing video when a channel turns the default on.
- Captions inside the HLS master (a `SUBTITLES` group), for offline downloads and casting; a later ticket can add it as a
  packaging step if a client needs it.
- Per-segment language tracks for videos that switch language.

## Testing plan

- Unit: the enable decision as an `it.each`; the window plan (threshold, window count, lead-in and tail); the merge (offsets,
  ownership by cue start, ordering) over synthetic windows; WebVTT serialisation; the failure classification (no audio, killed
  process, checksum, expired URL).
- Contract and integration: the stages over the in-memory and Postgres adapters with a fake whisper subprocess, fencing and a
  stale attempt; the flow shape at probe with captions on and off; the API over `@vp/permissions` with the suite's helpers.
- Real engine: one integration test runs the pinned binary and model on the committed clip (skipped without the model,
  required in CI where the image has it).
- Isolation and performance: a script under `tests/` runs the transcode queue with and without caption load and prints the
  p95 and the real-time factor for the PR.
- Player: component specs through the suite's single render helper; one browser test for cue alignment and live pick-up.

## Open questions

- Decided: captions are side-loaded WebVTT, not a `SUBTITLES` group in the master. A master rewrite after `READY` couples
  captions to packaging, races with a re-process that writes the same master (SDD §8.4), invalidates a master the CDN and the
  player already hold (hls.js does not re-read it), and would force a reload to show a late track. Side-loading touches no
  video artefact: the track appears when its row is `ready`, through the captions endpoint and a user event. The cost is that
  a client playing the bare HLS URL without our player (offline download, casting) sees no captions; that is out of scope.
- Decided: the trigger is `probe`, through the outbox, and not `package`. Audio is known at probe, the raw source is there, and
  captions start in parallel with the transcodes instead of after `READY`.
- Decided: captions have their own `video_captions` status and never a `videos.status`. `READY` means playable, and a caption
  failure must not demote a playable video or bump the version a creator's edit is checked against; no change to SDD §3.5
  and none to §8.4.
- Decided: speech-to-text is `whisper.cpp` with Whisper `small` q5_1, not `faster-whisper`. It is a single binary run as a
  subprocess, so the dual-runtime rule holds without a Python runtime in the image. `base` is the fallback model
  (`CAPTIONS_MODEL_PATH`) if the real-time factor in the criteria is missed on the reference worker; that is an image change.
- Decided: long sources split into fixed 180 s windows with a 5 s lead-in and tail, and cue ownership by start time, rather than
  silence-based splits. The plan is then known at probe time and built as one flow, as in 107, and the overlap costs about 5
  percent more audio. Silence splitting needs the audio first and would serialise the plan.
- Decided: opt-in channel default (`false`). Always-on would put a multi-minute CPU job behind every upload on a local-first,
  scale-to-zero deployment (SDD P8); a creator turns it on once.
- Decided: the language is a hint or the majority of the windows' auto-detection, one track per language. Mixed-language
  videos are captioned as spoken.
- Decided: caption style lives in the playback section of the settings catalogue, so 97's endpoint and 72's page need no new
  code path; if 72 has already put these keys in an accessibility section, they move there, not into a second store.
- Decided: the model is not perfect (names, jargon and music are wrong sometimes), so an auto track is labelled
  auto-generated in the menu and creator editing is in scope.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `docs/SDD.md` (§3.2 the captions branch from probe, §3.3 side-loaded tracks, §6.1, §7 keys, §9.1 and §9.2 the `captions` and `captions-chunk` queues and payloads, §9.8 the reconciler task, §13.1 metrics and §13.2 the ScaledObject, env table), `README.md` and `ARCHITECTURE.md` updated; `.env.example`, compose
      and k8s base carry the new keys.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
