# 139: Captions measurements - whisper speed, time to ready, transcode isolation, cue alignment, offline smoke

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 111 - Captions and transcripts |
| Blocks | — |
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
  `pnpm measure:captions cluster --prometheus <url> --pods 3 --window 30m`.
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
- [ ] The cue offsets of the 12-minute fixture match the media in a browser test (within 100 ms).
- [ ] `make smoke-offline` passes with the network disconnected and includes the captions step.

## Definition of Done

- [ ] All acceptance criteria proved with command output or dashboard numbers in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
