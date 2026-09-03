# 03: Dev tooling — deterministic video fixtures, dev JWT issuer, hls.js test page

| Field | Value |
|---|---|
| Phase | 0 — Bootstrap |
| Size | M |
| Blocked by | 01 — Repo skeleton + local infrastructure |
| Blocks | 04, 06 |
| Spec | [PRD FR-15, FR-18](../PRD.md#6-functional-requirements) · [PRD OQ-1 auth](../PRD.md#12-open-questions-to-resolve-during-phase-01) · [SDD §14.1 Principles (synthetic media)](../SDD.md#141-principles) · [SDD §11 Authentication](../SDD.md#11-security) · [SDD §16.5 Auth env](../SDD.md#165-auth) |

**Status:** ready-for-agent

## What to build
Three tools a human or agent uses for the rest of the project: (1) `pnpm gen-video` produces copyright-free, byte-reproducible test videos (a standard set and a *hostile* set) from a manifest; (2) `pnpm dev-token mint` issues an EdDSA JWT and serves/writes a JWKS so the API can be called with `Authorization: Bearer …` without any identity provider; (3) a static hls.js test page where you paste API URL + token + videoId, fetch the video, play it, and watch SSE events — proven today against a public HLS sample, used from ticket 07 on against our own output.

## Acceptance criteria
- [ ] Fixtures per manifest: `s15`, `s60`, `m10` (10 min), `l30` (30 min 720p), `p720`, `sd360`, `portrait` (rotation tag), `vfr`, `k60` (4K60); hostile: `truncated`, `audio-only`, `hevc.mkv`, `zero-bytes`, `not-a-video`, `over-duration` (behind `--include-slow`). Generated with `testsrc2` + `sine` + burnt-in timecode; git-ignored output; `--check` verifies sha256 (or ffprobe metadata if hashes differ across OSes — document which).
- [ ] Fast set generates in < 3 min on 8 vCPU; every non-hostile file probes cleanly.
- [ ] `dev-token mint --sub <uuid> --role admin --ttl 8h` → JWT with `iss=vp-dev`, `aud=vp-api`; verifies against the JWKS in a unit test; expired token rejected.
- [ ] Test page (with vendored hls.js) plays a public HLS sample when online; Load/Play/Subscribe controls present; SSE log + per-rendition progress bars render from the `SseEvent` shape in SDD §20 (mock data for now).

## Out of scope
Real IdP integration (interface fixed by JWKS; provider is config later).

## Notes for the implementer
- Decide and document whether the API serves the dev JWKS itself in development or the tool serves it on its own port; SDD assumes the API serves it in dev.
- **Vendor hls.js into the repo** (pinned version + license) — no CDN references, per the local-first principle (SDD P9, ticket 35); keep the page a single HTML file plus the vendored script.

## Testing plan
Unit for mint/verify; `--check` in CI (02 cache step); page verified manually with a screenshot in the PR.

## Open questions
- Sprite density for the test page's preview (1 frame / 5 s assumed — PRD OQ-4).

## Definition of Done
- [ ] Tools documented in README "Try it locally"; fixture cache enabled in CI.
