# 111: Captions and transcripts - local speech-to-text, WebVTT in the HLS master, creator and viewer controls

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 07 - transcode-720p + package + notify · 17 - Housekeeping · 26 - KEDA autoscaling · 30 - Transactional outbox · 44 - Creator studio video management · 47 - Multi-resource search engine · 57 - Production video player · 59 - Modern video watch page · 60 - Creator studio dashboard · 62 - Remove the legacy frontend · 72 - Settings · 97 - Account preferences API · 98 - Realtime user event stream |
| Blocks | 112 |
| Spec | [PRD §6 Functional requirements](../PRD.md#6-functional-requirements) · [SDD P9 Local-first](../SDD.md#13-design-principles-used-to-break-ties-throughout) · [SDD §3.2 Processing pipeline](../SDD.md#32-processing-pipeline-fan-out--fan-in) · [SDD §3.3 Playback](../SDD.md#33-playback) · [SDD §7 Object storage layout](../SDD.md#7-object-storage-layout) · [SDD §8.4 Master playlist](../SDD.md#84-master-playlist-generated-by-package-not-by-ffmpeg) · [SDD §9.1 Queue topology](../SDD.md#91-queue-topology) · [SDD §9.7 Idempotency](../SDD.md#97-idempotency-guarantees-per-step) · [SDD ADR-18](../SDD.md#adr-18--error-taxonomy-decides-retry-policy) |

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
> **Local, as everything is.** Speech-to-text runs on the worker's CPU from a pinned model file baked into the image at
> build time. No transcription API, no key, no egress ([PRD G11](../PRD.md#3-goals--non-goals), SDD P9); `make smoke-offline`
> proves it.

## What to build

### 1. Generation: a `captions` stage, off the critical path

- **Engine.** `whisper.cpp` (MIT) run as a subprocess by the worker, the way `ffmpeg` is, so worker code stays free of
  `Bun.*` and native addons and passes under Node and Bun alike (rule 2). The model is OpenAI Whisper `small`, multilingual,
  quantized (`ggml-small-q5_1.bin`, MIT), with Silero VAD (MIT) to skip silence and cut hallucinated text over it. Both
  binary and model are fetched in the worker image build, pinned by tag and SHA-256 in one lock file, and checked at start;
  nothing is fetched at runtime. The tags are the current releases when the ticket is picked up (`npm view` / `gh release
  list`, never an old pin copied from this text).
- **Input.** Mono 16 kHz audio extracted with `ffmpeg` from the lowest `DONE` rendition (HLS audio is present after
  READY, and the raw source may already have expired under its 7 day lifecycle, SDD §7).
- **Placement.** A new queue `captions`, not a Flow child of `package`. `package` writes the master and moves the video to
  `READY` exactly as today; in the same outbox transaction ([30](30-transactional-outbox.md)) it enqueues one `captions`
  job when captions are enabled for the video (see 3). The video never waits for captions: playable first, captions attach
  later. A failed or skipped caption job never touches `videos.status`.
- **Job and identity.** `CaptionsJob` in `@vp/job-contracts` (`Base` plus `{ language?: string }`), id
  `ids.captions(videoId, generation)`, `QUEUES` and `stagePolicies.captions` (`attempts: 3`, exponential 30 s with jitter
  0.5), lowest priority. `WorkerStageName` gains `captions` and `registry.ts` a definition; the stage runs one job per pod
  with `heartbeat` for the lock (SDD §9.5).
- **Fencing.** The stage claims a `captions` step row with a lock token (`repositories.steps.claim`, as `package` does) and
  commits through the fenced complete; a stale worker is fenced out and does not overwrite a newer attempt (rule 6).
- **Retry classes (rule 7).** `PermanentError`: no audio stream (the track row becomes `SKIPPED`, `reason: NO_AUDIO`, and
  the job succeeds), model file missing or checksum mismatch, whisper exit code for bad input. `TransientError`: storage or
  database unavailable, whisper killed (OOM, `SIGKILL`) or timed out, queue unavailable. Job timeout is
  `2 x durationMs + 5 min`.
- **Output.** Cues from whisper's JSON output become the track: `captions/{lang}/captions.vtt`, an HLS WebVTT media
  playlist `captions/{lang}/index.m3u8` (one segment, `EXT-X-PLAYLIST-TYPE:VOD`), and the plain transcript rows. The
  detected language is stored on the track. The first-PTS offset of ffmpeg's MPEG-TS output (it starts above zero) is
  covered by an `X-TIMESTAMP-MAP` header in the `.vtt`, checked against the rendition's real first PTS.
- **Master.** `generateMasterPlaylist` (`@vp/ffmpeg`) takes `captions: CaptionTrack[]` and emits one
  `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",...` per track with `CHARACTERISTICS` for an auto-generated one, and adds
  `SUBTITLES="subs"` to every `#EXT-X-STREAM-INF`. Both `package` and the captions stage rebuild the master from the same
  rows through that one function, so the last writer produces the same bytes (SDD §8.4); a re-process (new generation)
  picks the tracks up from the rows. Caption objects live outside `hls/`, so a generation purge never deletes them.
- **Storage keys** (`packages/server/storage/src/keys.ts`, SDD §7): `captionsPrefix(videoId)`,
  `captionsPlaylistKey(videoId, lang)`, `captionsFileKey(videoId, lang)` under `videos/{videoId}/captions/{lang}/`, public
  bucket, `text/vtt` and `application/vnd.apple.mpegurl`, `Cache-Control: public, max-age=60` (they are editable). The
  relative `URI` from the master to the playlist is computed beside the key functions, since the master's depth differs per
  generation.
- **Data.** `video_captions` (one row per video and language: `kind` `auto | edited | uploaded`, `status` `PENDING | RUNNING
  | READY | FAILED | SKIPPED | DISABLED`, `language`, `detected_language`, `version`) and `video_transcript_cues` (cue
  index, start and end ms, text, a `simple` `tsvector` with a GIN index, matching how search ranks text in SDD §5). Every
  status change is a compare-and-set that appends a `video_events` row in the same transaction.
- **Housekeeping.** `purge-deleted` removes the captions prefix and rows; a `reconcile-captions` task re-enqueues enabled
  videos that are `READY` with no caption row after one hour (ADR-16 idempotent enqueue plus reconciler).
- **Scaling and budgets.** `captions` is its own worker pod and queue: concurrency 1, `cpu` request 2 and limit 4, memory
  limit 2 GiB, `CAPTIONS_THREADS` equal to the CPU limit as `FFMPEG_THREADS` is. A `ScaledObject` (min 0, max 2) on queue
  depth ([26](26-keda-autoscaling-graceful-shutdown.md), SDD §13.2), a compose service and `make up worker:captions`.
  Transcoding never competes with it for cores because pods are separate. Metrics: `captions_seconds` per audio second
  (real-time factor), jobs by outcome, queue age; a dashboard row and an alert on queue age over 6 h.
- **Env.** `CAPTIONS_ENABLED` (platform kill switch, default `true`), `CAPTIONS_MODEL_PATH`, `CAPTIONS_THREADS`, declared in
  `@vp/env-schema`, `.env.example`, compose and the k8s base (`env-key-closure.test.ts`). No secret-shaped key.

### 2. Transcript API

- `GET /v1/videos/:id/captions` lists tracks (language, kind, label, `url`); `GET /v1/videos/:id/transcript?lang=&q=` returns
  cues, with `q` filtering through the `tsvector` (`websearch_to_tsquery`, same configuration as search). Visibility
  follows the video: whoever may watch it may read its transcript.
- Contracts in `@vp/api-contracts`, one source for the OpenAPI document (`pnpm gen:contracts`), SDD §6.1 updated.

### 3. Creator controls (Studio)

- **Switch.** `videos.autoCaptions` (`true | false | null`, `null` follows the channel) and `channels.autoCaptionsDefault`
  (default `false`: transcription costs CPU, so it is opt-in). The decision is made by one pure function when `package`
  enqueues the job. Enabling it on an already `READY` video enqueues the job immediately; the channel default applies to
  uploads from then on and does not backfill.
- **Studio video edit page** gets a Captions section: the switch, the track list with status, the generated cues editable as
  text (timing stays as generated), replace with an uploaded `.vtt`, delete a track, and regenerate. Studio updates live
  through the user event stream ([98](98-realtime-user-event-stream.md), a `captions.ready` event type). The channel default
  is a channel setting.
- **Upload and edit endpoints**: `PUT /v1/videos/:id/captions/:lang` (a `.vtt` body up to 1 MiB, parsed by a maintained
  WebVTT parser, never a regex stack; a malformed file is a `422` with the line), `PATCH` for cue text, `DELETE`, and
  `POST .../captions/generate`. An edited or uploaded track is never overwritten by regeneration unless the creator
  confirms. At most 10 tracks per video.
- **Permissions** in `@vp/permissions`: a `Caption` subject, `read` as the video's read rule, `manage` for the video's owner
  and `manage all`. No inline owner or role check anywhere.

### 4. Viewer controls (player and watch page)

- **Port.** `PlayerState` in `player-port.ts` gains `captionTracks`, `activeCaptionTrack`, `captionsEnabled` and the cues of
  the active track; `PlayerCommands` gains `selectCaptionTrack(id | null)`. The Video.js 10 engine
  (`engine/video-js-engine.tsx`) maps the HLS SUBTITLES group onto them; no skin imports the engine's types.
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
      reaches `READY`, and then its `video_captions` row reaches `READY` with `detected_language` correct and a transcript
      whose word error rate against the known text is at most 0.25. The video's `READY` time is unchanged by whether
      captions are enabled (the `READY` event precedes the `captions` job start).
- [ ] The master playlist of that video contains an `EXT-X-MEDIA` SUBTITLES entry and every `EXT-X-STREAM-INF` carries
      `SUBTITLES="subs"`; a browser test plays it and shows a cue within 100 ms of the audio (the `X-TIMESTAMP-MAP` case).
- [ ] `make smoke-offline` passes with the network disconnected and includes the captions step; the image build fails when
      the model's SHA-256 does not match the lock file; `local-first-check` passes (no new host, no runtime download).
- [ ] A video without an audio stream ends with the track `SKIPPED`, the job `completed`, and the video untouched.
      Killing whisper mid-run retries and succeeds; a stale worker's commit is fenced out (`captions` step test).
- [ ] The enable decision is table-tested: video `true`, `false` and `null` against channel `true` and `false`; disabling a
      video with a `READY` track hides it from the master and keeps the row.
- [ ] Studio: a creator enables captions on an existing video, sees the track appear, edits a cue, uploads a replacement
      `.vtt` (a malformed file shows its line error), and a regenerate asks before overwriting an edited track.
- [ ] Player: captions toggle, language switch, the `c` shortcut, size and background from the saved preferences, and the
      transcript panel (highlight, click to seek, search) work; the toggle is absent when no track exists.
- [ ] A non-owner `PUT`, `PATCH` or `DELETE` on captions is `403`; a private video's transcript is `404` for others
      (`@vp/permissions` specs).
- [ ] One worker pod transcribes a 10-minute fixture in at most 10 minutes on 4 threads (real-time factor 1.0 or better),
      recorded in the PR with `captions_seconds`; `pnpm typecheck`, `lint`, `knip`, `test`, `test:bun`,
      `test:architecture` green, with output in the PR.

## Delivery

One PR, committed in this order so each commit builds and passes on its own: (1) contracts, keys, schema, env keys and
`@vp/ffmpeg` master and playlist generation; (2) the `captions` stage, queue, KEDA and compose wiring, image build and
smoke step; (3) transcript and caption API with permissions; (4) catalogue additions and the player port, skin and
transcript panel; (5) Studio controls; (6) SDD, README and ARCHITECTURE updates.

## Out of scope

- Translating captions into other languages, and dubbing.
- Speaker labels, word-level timing and live captions for [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md).
- Platform-wide search over transcripts (the cues are indexed here and searched inside one video; wiring them into
  [47](47-multi-resource-search-engine.md) results is a follow-up).
- Timing edits in the Studio (upload a `.vtt` for that), and a hosted or GPU transcription path.
- Backfilling captions for every existing video when a channel turns the default on.

## Testing plan

- Unit: the enable decision as an `it.each`; `generateMasterPlaylist` with and without tracks; key functions; WebVTT
  serialisation and the timestamp map; the failure classification (no audio, killed process, checksum).
- Contract and integration: the stage over the in-memory and Postgres adapters with a fake whisper subprocess, fencing and
  a stale attempt; the API over `@vp/permissions` with the suite's helpers.
- Real engine: one integration test runs the pinned binary and model on the committed clip (skipped without the model,
  required in CI where the image has it).
- Player: component specs through the suite's single render helper; one browser test for cue alignment.

## Open questions

- Decided: speech-to-text is `whisper.cpp` with Whisper `small` q5_1, not `faster-whisper`. It is a single static binary run
  as a subprocess, so the dual-runtime rule holds without a Python runtime in the image; faster-whisper would add Python.
  `base` is the fallback model (`CAPTIONS_MODEL_PATH`) if the real-time factor in the last criterion is missed on the
  reference worker; that is an image change, not a code change.
- Decided: captions are a separate table and queue, and never a video status. `READY` already means "playable", and a
  caption failure must not demote a playable video, so no `videos.status` transition and no change to SDD §3.5.
- Decided: opt-in channel default (`false`). Always-on would put a multi-minute CPU job behind every upload on a
  local-first, scale-to-zero deployment (SDD P8); a creator turns it on once.
- Decided: audio comes from the lowest `DONE` rendition, so a late or replayed job does not depend on the raw source that
  lifecycle has already expired.
- Decided: one WebVTT segment per track. A one-hour transcript is a few hundred KiB, so splitting it only adds playlist
  entries.
- Decided: caption style lives in the playback section of the settings catalogue, so 97's endpoint and 72's page need no new
  code path; if 72 has already put these keys in an accessibility section, they move there, not into a second store.
- Decided: the Whisper model's accuracy is bounded: names, jargon and music are wrong sometimes. The track is labelled
  auto-generated in the master (`CHARACTERISTICS`) and in the player menu, which is why creator editing is in scope.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `docs/SDD.md` (§3.2, §6.1, §7, §8.4, §9.1, env table), `README.md` and `ARCHITECTURE.md` updated; `.env.example`, compose
      and k8s base carry the new keys.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
