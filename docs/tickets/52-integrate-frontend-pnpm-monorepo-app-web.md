# 52: Frontend integration as monorepo app (`apps/web`) with shared contracts & unified DX

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#52](https://github.com/szebest/taitube-platform/issues/52) |
| Size | L |
| Blocked by | 45 — Frontend API modernization · 49 — Next-Gen frontend API gateway · 50 — Shared API contracts |
| Blocks | 53, 54, 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

### The Architectural Decision: Monorepo (`apps/web`) vs Git Submodule vs Separate Repo

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Git Submodule** | Keeps git history isolated | Painful developer experience, detached HEAD states, requires manual hash pinning, broken PR previews, separate CI steps, cannot easily share workspace packages | **Rejected** |
| **Separate Repo** | Independent access control | Contract drift between frontend DTOs and backend Zod schemas, duplicated types, double PRs for every single feature | **Rejected** |
| **Monorepo App (`apps/web`)** | Single PR changes full stack, shares TypeScript types directly from `@taitube/*`, single `pnpm install`, unified Turborepo caching, seamless local-first `make up` | Slightly larger initial git clone | **Accepted (Recommended)** |

This ticket integrates `youtube-frontend` directly into this repository as **`apps/web`**, turning this project into a unified, full-stack video streaming platform.

This ticket delivers:
1. **Repository Ingestion & Workspace Setup**:
   - Ingests `youtube-frontend` into `apps/web/`.
   - Aligns `package.json` namespacing (`@taitube/web` or `@taitube/web`) within the pnpm workspace (`apps/*` is already configured in `pnpm-workspace.yaml`).
   - Hooks into `turbo.json` so `pnpm dev`, `pnpm build`, `pnpm lint`, and `pnpm test` orchestrate API, workers, and Web frontend together.
2. **Direct TypeScript Contract Sharing**:
   - Replaces fragile, hand-written frontend API types with shared types exported from `@taitube/core` or `apps/api/schemas`.
   - Guarantees zero contract drift at compile-time: if a backend endpoint or response changes, frontend typechecking immediately flags it.
3. **Environment & Gateway Configuration**:
   - Configures `VITE_API_URL` (or `NEXT_PUBLIC_API_URL`) to proxy to `http://localhost:3000` locally.
   - Updates Docker Compose and local developer scripts to support running the full stack with one command (`pnpm dev` or `make up-all`).
4. **Offline & Local-First Verification**:
   - Ensures `apps/web` works 100% offline against local MinIO, local Postgres, and local API without contacting external CDNs or Facebook Auth.

- [ ] Modern toolchain alignment: `apps/web` standardizes on **Node 24+**, **TanStack Start** (`@tanstack/react-start`), **TanStack Router** (`@tanstack/react-router`), **Vite 6** (migrating away from legacy Create React App / Webpack 4), **React 19**, and **TypeScript 5.7+**.
- [ ] Frontend code integrated under `apps/web/` with clean pnpm dependencies (no npm/yarn lockfiles left behind).
- [ ] `turbo.json` tasks (`build`, `dev`, `lint`, `typecheck`) include `apps/web` without breaking existing API and worker tasks.
- [ ] Biome / ESLint configuration harmonized with root repo standards (`pnpm lint` covers `apps/web`).
- [ ] Direct import or shared package linkage of API contract DTO types in `apps/web/src/types/api.ts`.
- [ ] `pnpm dev` concurrently launches `apps/api`, `apps/worker`, and `apps/web`.
- [ ] Vite 6 dev proxy configured so browser calls to `/v1/*` or `/videos/*` forward seamlessly to the Fastify server without CORS friction.
- [ ] `apps/web` runs in local-first mode: video playback connects to local MinIO HLS streams (`http://localhost:9000/...`), SSE connects to `http://localhost:3000/v1/videos/:id/events`.
- [ ] E2E smoke test: A user can open `http://localhost:5173`, view the public feed, upload a video, see live SSE transcoding progress, and play the transcoded HLS stream in the player.

## Out of scope

- Complete UI redesign of the frontend pages (handled in subsequent UX polish iterations).
- Mobile apps (React Native / Flutter).

## Notes for the implementer

- **Preserving Git History (Optional but clean):** Use `git subtree add --prefix=apps/web https://github.com/szebest/youtube-frontend.git main --squash` to import the frontend codebase cleanly.
- **Strict dual runtime & local-first:** Ensure the web build does not inject any external telemetry or unpinned third-party CDN scripts.

## Testing plan

- Workspace test: Run `pnpm build` from the repo root and assert all packages (`apps/api`, `apps/worker`, `apps/web`, `packages/*`) compile with 0 errors.
- Integration test: Launch the full stack and verify `apps/web` can upload a file and playback an existing seeded video.

## Definition of Done

- [ ] `pnpm build` and `pnpm typecheck` pass across all workspace packages including `apps/web`.
- [ ] Full local stack boots and serves frontend on browser.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
