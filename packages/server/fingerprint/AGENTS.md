# AGENTS.md — @vp/fingerprint (Frame and Audio Fingerprints, Duplicate Matching)

Instructions for any coding agent working on `@vp/fingerprint`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/fingerprint` turns a video's frames and audio into the derived data the duplicate check compares,
and finds which stored videos a new one overlaps. Tier `server`, `vp.layer` 4: it runs subprocesses
through `@vp/ffmpeg`'s `runFfmpeg` and reads and writes through the `FingerprintRepository` port of
`@vp/core`; its dependencies are in [package.json](package.json). The `screen` stage (ticket 112) is its
consumer. It matches against the platform's own catalogue only; a score is evidence for a moderator,
never a verdict.

- **Frames:** `buildFrameSamplingArgs` samples a 9x8 greyscale frame every `intervalSeconds`
  (`fps=1/2`) as raw bytes; `sampleFrames` runs it and `sampleFrame` gives each frame its 64-bit `dHash`,
  the hash of its mirror image and its mean luma, in plain TypeScript, the same on Node and Bun.
- **Bands:** `frameBands` and `hammingDistance` live in `@vp/domain`. A frame within Hamming distance 3 of
  another shares one of the four 16-bit bands exactly, so the repository answers a band lookup and
  `matchFrames` makes the exact distance check, once straight and once on the mirrored hash.
- **Audio:** `runFpcalc` runs the `fpcalc` binary (`FPCALC_PATH`) with `-raw -json -length <duration>`
  and `parseFpcalcOutput` reads the Chromaprint terms as signed 32-bit integers. `audioIndexTerms` keeps
  every `audioIndexStride`th term for the index; a lookup queries every term of the new video, because
  only the stored side is a subsample.
- **Matching:** `voteOffset` lets each matched pair vote for `matchIdx - queryIdx` (neighbours within one
  sample vote together) and `longestRun` finds the longest stretch, one missed sample allowed.
  `matchFrames` gives `coverage` and `longestRunSeconds`, `verifyAudio` a bit-error-rate over the longest
  matching run; `findMatches` keeps the candidates at or over `partialCoverage` or `partialRunSeconds`
  with `score = max(video coverage, audio coverage)`, both kept as evidence. `storeFingerprint` writes
  what a later upload is matched against.

---

## 2. Invariants

- No native dependency and no `Bun.*`: the specs run under `vitest` and `bun test`, and the two
  subprocesses are spawned with an argument array, never a shell string.
- Nothing here reads a tuning value of its own. Thresholds (`ScreeningThresholds` in `@vp/domain`) and
  sampling (`SCREENING_SAMPLING` in `@vp/env-schema`) arrive as arguments from the stage, so a result can
  name the thresholds it was decided under.
- A runner throws a classified error at the throw site (rule 7); the parser and the lookup return a
  `Result`.
- The new video's own rows are never candidates: the repository excludes `videoId` from every lookup.

---

## 3. Local Commands

```bash
pnpm --filter @vp/fingerprint typecheck
pnpm --filter @vp/fingerprint test
```
