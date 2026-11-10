# Runbook: Screening Hold Rate

## 1. Overview
The `screen` stage holds a video for a moderator when a finding passes its bar (a duplicate, an explicit frame, a blank picture, spam text, or a screening that failed). `ScreeningHoldRateHigh` fires when more than 20% of the videos screened in 24 hours were held, with at least 20 screened. A rate that high is usually a threshold that no longer fits the uploads, not a wave of bad ones: the moderation queue fills and creators wait.

## 2. Diagnosis
Split the holds by reason:
```promql
sum by (reason) (increase(screening_outcomes_total{outcome="HOLD"}[24h]))
```
- `SCREEN_ERROR` high: the model or `fpcalc` is failing and the stage is failing closed. Check `worker-screen` logs and the `SCREEN_MODEL_INVALID` / `SCREEN_MODEL_FAILED` codes in the DLQ. If the model file is damaged, redeploy the image; the adapter refuses a file whose SHA-256 is not the pinned one.
- `NSFW` high: the classifier reads ordinary footage as explicit. Read the evidence frames of a few held videos in the moderation queue before changing `nsfwFrameThreshold` or `nsfwShareThreshold`.
- `DUPLICATE` or `KNOWN_REJECTED` high: look for a re-upload wave, then for a fingerprint that matches too loosely (`frameMaxHamming`).
- `BLANK` high: a source type with a long still picture (slides, audio-only uploads); raise `blankFrameShare` only after a moderator confirms they are fine.

## 3. Remediation
Thresholds are tuning constants in `packages/server/env-schema/src/tuning.ts` and each stored result names the version it was decided under, so a change is a new `version` and never rewrites a decided case. As a last resort set `SCREENING_ENABLED=false`: probe then adds no `screen` child and nothing is held. Re-enable it once the thresholds are fixed.
