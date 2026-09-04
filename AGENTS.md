# AGENTS.md — video-pipeline

Instructions for any coding agent (Codex, Gemini CLI, Cursor, Copilot, OpenCode, Claude Code via `CLAUDE.md`) working in this repository.

## What this repo is
An asynchronous video ingestion and HLS transcoding backend: Fastify API (Node 24), BullMQ workers (Bun 1.4, runtime-switchable), PostgreSQL + Drizzle, Redis, S3-compatible storage (MinIO locally, Cloudflare R2 in cloud), FFmpeg, KEDA autoscaling, k6 load tests. Read `docs/PRD.md` for requirements and `docs/SDD.md` for the design — **but only the sections a ticket links to**; the SDD is long by design.

## How work is organised
- Work items are tracer-bullet tickets in `docs/tickets/NN-slug.md`; the index `docs/tickets/README.md` shows the frontier (tickets whose blockers are done). Use the `vp-work-ticket` skill to pick one up.
- Numbering is dependency order, not priority. Never start a ticket whose blockers are not `done`.
- Ticket status lives in the ticket's `**Status:**` line; run `python3 docs/tickets/gen-index.py` after changing it.

## Non-negotiable rules
1. **Local-first (PRD G11, SDD P9):** no runtime dependency on any external service; `.env.example` stays all-local; nothing phones home; `make smoke-offline` must pass. See the `vp-local-first-check` skill.
2. **Dual runtime:** worker code and shared packages must pass under `vitest` and `bun test`; no `Bun.*` APIs.
3. **Contracts are single-sourced:** job payloads/ids in `packages/job-contracts`, object keys in `packages/storage/keys.ts`, error codes in `packages/errors` (SDD §6.2), env in `packages/config` mirrored by `.env.example`. Changing one means updating the SDD in the same PR.
4. **Dependency inversion / ports & adapters:** Concrete SDKs (`@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm`) must never be imported outside `adapters/` and composition roots (`apps/api/src/app.ts`, `apps/worker/src/runner.ts`). Domain logic and routes depend on abstract class ports in `@vp/core/ports` (`hexagonal-port-adapter`).
5. **State changes go through the CAS helper** that also appends `video_events`; worker commits use fencing tokens (`vp-postgres-cas-fencing`).
6. **Errors are classified at the throw site** (`PermanentError` vs `TransientError`, ADR-18).
7. **Prove, don't claim:** run typecheck/lint/tests and paste output before saying done (`verification-before-completion`).

## Commands
`make up` (infra) · `make up-all` (everything) · `make smoke` · `make smoke-offline` · `pnpm dev` · `pnpm test` · `pnpm test:integration` · `bun test` (worker parity) · `pnpm lint` · `pnpm typecheck` · `make k3d-up && make k3d-deploy` (Kubernetes) · `make e2e` (Phase 2 acceptance).

## Agent skills

Skills live in `.agents/skills/` (Codex, Gemini CLI, Cursor, Copilot, OpenCode) with symlinks in `.claude/skills/` (Claude Code). Start with `vp-work-ticket`; it routes to `tdd`, `code-review`, `verification-before-completion` and the domain skills (`hexagonal-port-adapter`, `vp-ffmpeg-hls-ladder`, `vp-bullmq-pipeline`, `vp-keda-queue-autoscaling`, `vp-fastify-sse-problem-json`, `vp-postgres-cas-fencing`, `vp-chaos-toxiproxy`, `vp-local-first-check`).

### Issue tracker

Local markdown tickets under `docs/tickets/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` (glossary) at the repo root and ADRs in `docs/SDD.md` §4 (mirrored into `docs/adr/` as they evolve). See `docs/agents/domain.md`.
