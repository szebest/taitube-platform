# 52: Frontend integration as monorepo app (`apps/web`) with shared contracts & unified DX

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#52](https://github.com/szebest/taitube-platform/issues/52) |
| Size | L |
| Blocked by | None - absorbed by 82, 88, 89 and 75 |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

## Absorbed

The app is already in the workspace, and the rest moved to the tickets that own it:

- `apps/web` is in the repo as `@vp/web` (subtree import, then tickets 82 and 88), inside the pnpm workspace,
  turbo, lint and typecheck.
- Contract types are shared through `@vp/api-contracts`; there are no hand-written API types left to replace.
- Toolchain move to Vite, TanStack Start and React 19, `pnpm dev` starting the web app, turbo caching:
  [89](89-web-tanstack-start-foundation.md).
- Full-stack smoke (upload, SSE progress, HLS playback in a real browser): [75](75-fullstack-e2e-playwright-security-perf-validation.md).
