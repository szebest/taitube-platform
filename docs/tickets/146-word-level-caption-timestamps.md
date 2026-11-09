# 146: Word-level caption timestamps so per-cue edges meet 100 ms

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 139 - Captions measurements - whisper speed, time to ready, transcode isolation, cue alignment, offline smoke |
| Blocks | — |
| Spec | [111 Captions and transcripts](111-captions-and-transcripts.md) · [139 outcome](139-captions-measurements.md#outcome) |

**Status:** blocked

## What to build

139 measured the generated cues against the speech in the truth file: the first cue start and the last cue end are
within 100 ms and the offset does not drift, but individual cue edges sit 0.3 to 4 s from the speech edges. Whisper
cuts its segments on VAD boundaries about ten seconds long, and the cue times are the segment times.

Take word-level timestamps from whisper (`--max-len 1 --split-on-word` or the token timestamps in the JSON output)
and build each cue from the words it holds, so a cue starts at its first word and ends at its last.

## Acceptance criteria

- [ ] The captions stage derives cue start and end from word timestamps, not segment times.
- [ ] Against the 12-minute fixture, every cue start and end is within 100 ms of the nearest speech edge in the truth
      file, checked by `compareCues` with a per-cue failure restored.
- [ ] The real-time factor on one pod at 4 threads stays at 1.0 or better after the change.

## Out of scope

- Re-measuring on a cluster; the cluster commands are in the 139 outcome.
