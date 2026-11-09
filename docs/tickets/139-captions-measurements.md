# 139: Captions measurements - whisper speed, time to ready, transcode isolation, cue alignment, offline smoke

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 111 - Captions and transcripts |
| Blocks | 146 |
| Spec | [111 Captions and transcripts](111-captions-and-transcripts.md) · [SDD §3.2 Processing pipeline](../SDD.md#32-processing-pipeline-fan-out--fan-in) · [SDD §3.3 Playback](../SDD.md#33-playback) |

**Status:** in-progress

> **Why.** 111 shipped captions with the behaviour proved by tests, but three of its acceptance criteria are
> measurements that need a real cluster, a browser on the full pipeline, or the network unplugged. They were left
> unticked there and move here, worded as 111 wrote them.

## What to measure

- On a real cluster (`make k3d-up && make k3d-deploy`, or the cloud cluster): whisper's real-time factor on one
  `captions` pod at 4 threads (`captions_realtime_factor`), the time from `complete` to a `ready` track for a
  10-minute fixture (`captions_time_to_ready_seconds`) with 3 caption pods and with one, and the `transcode-720p` job
  duration p95 with captions at full load against the same run with the `captions` queue paused.
- In the browser harness (`pnpm test:browser`): the cue offsets of the merged 12-minute fixture against the media.
- `make smoke-offline` with the network disconnected, the captions step included.

The numbers go in the PR body, with the Grafana panel or query each came from.

## How to measure

`pnpm measure:captions` reads the numbers and prints the PromQL behind each; `pnpm test:browser` does the cue check.

- Whisper on one machine, CPU only at 4 threads: `pnpm gen:speech-fixture` (macOS `say`) then
  `pnpm measure:captions whisper --truth tests/fixtures/c12.truth.json`; `--seconds N` limits the audio.
- Cluster, after uploading the 10-minute fixture with 3 caption pods (then with 1):
  `pnpm measure:captions cluster --prometheus <url> --pods 3 --span <start>,<end>` (ISO times of that run; repeat with
  `--pods 1` over the 1-pod run's own span).
- Isolation, two runs of the same upload load, the second with the `captions` queue paused:
  `pnpm measure:captions isolation --prometheus <url> --running <start>,<end> --paused <start>,<end>` (ISO times).
- Cue offsets against the media, on a running stack:
  `pnpm test:browser --fixture tests/fixtures/c12.mp4 --truth tests/fixtures/c12.truth.json --timeout-sec 3600`.

`captions_time_to_ready_seconds` runs from the track row's creation at probe, not from `complete`, so it is a little
longer than the criterion's span.

## Acceptance criteria

- [ ] Performance, measured and recorded in the PR: whisper's real-time factor on one pod at 4 threads is 1.0 or better;
      for a 10-minute fixture the time from `complete` to a `ready` track is at most 6 minutes with 3 caption pods
      available and at most 12 minutes with one; and with captions running at full load the transcode p95 (job duration,
      `transcode-720p`) is within 5 percent of the same run with the `captions` queue paused (the isolation claim).
- [ ] The cue offsets of the 12-minute fixture match the media in a browser test: the first cue start and the last
      cue end within 100 ms of the first and last speech, and no drift across the file. Per-cue edges are printed, not
      failed (see Outcome). The browser run is not done yet, so this stays unticked.
- [ ] `make smoke-offline` passes with the network disconnected and includes the captions step.

## Definition of Done

- [ ] All acceptance criteria proved with command output or dashboard numbers in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.

## Outcome

Measured on an M3 Pro, not on a pod, so these numbers say nothing about the cluster criteria.

- Whisper speed: real-time factor 3.84 at 4 threads, CPU only, on the 720 s fixture with `ggml-small-q5_1`. This is a
  laptop number, not a pod number.
- Cue alignment, from `pnpm measure:captions whisper --truth`: 82 cues over 114 utterances, the first cue start 20 ms
  off the first speech start, the last cue end 38 ms off the last speech end, no drift. The 100 ms criterion means
  offset and drift only. Per-cue edges are 0.3 to 4 s off the speech edges, a known limit of whisper's roughly ten
  second VAD segmentation, printed as information and not failed. [146](146-word-level-caption-timestamps.md) takes
  word-level timestamps to close it.
- `captions_time_to_ready_seconds` is measured from the track row's creation at probe, not from `complete`.

Not measured:

- Time to ready, 10-minute fixture, 3 caption pods and then 1: not measured, needs cluster / Prometheus.
  `pnpm measure:captions cluster --prometheus <url> --pods 3 --span <start>,<end>` (then `--pods 1` over its own span).
- Transcode p95 with captions at full load against the `captions` queue paused: not measured, needs cluster /
  Prometheus. `pnpm measure:captions isolation --prometheus <url> --running <start>,<end> --paused <start>,<end>`.
- Cue offsets in the browser: not measured, needs a running stack.
  `pnpm test:browser --fixture tests/fixtures/c12.mp4 --truth tests/fixtures/c12.truth.json --timeout-sec 3600`.
- Captions step with the network disconnected: not measured, needs an offline run. `make smoke-offline`.
