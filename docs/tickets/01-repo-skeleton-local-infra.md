# 01: Repo skeleton + local infrastructure (`make up && pnpm test` green on a fresh clone)

| Field | Value |
|---|---|
| Phase | 0 — Bootstrap |
| Issue | [#1](https://github.com/szebest/taitube-platform/issues/1) |
| Size | M (one focused session) |
| Blocked by | None (can start immediately) |
| Blocks | 02, 03, 04, 31, 48 |
| Spec | [SDD §15.1 Repository layout](../SDD.md#151-repository-layout-monorepo-video-pipeline) · [SDD §15.2 Toolchain](../SDD.md#152-toolchain) · [SDD §12.1 Compose](../SDD.md#121-rung-1-docker-compose-local-dev-phase-02) · [SDD §7 Storage layout](../SDD.md#7-object-storage-layout) · [ADR-05](../SDD.md#adr-05-redis-flavour-self-hosted-redis-7-valkey-8-next-to-the-workers) · [ADR-11](../SDD.md#adr-11-repository-topology-modular-monorepo-multiple-deployables-one-worker-image) · [`.env.example`](../../.env.example) |

**Status:** done

## What to build
A developer (or agent) clones the repo, runs `make up` and `pnpm install && pnpm test`, and gets: Postgres, Redis (BullMQ-safe config) and MinIO with the `raw`/`public` buckets, lifecycle rules and anonymous-read policy already applied; a pnpm + Turborepo monorepo with the `apps/*` and `packages/*` placeholders from SDD §15.1, each with one passing smoke test; Biome lint/format; lefthook pre-commit; a README quick start. No business code yet — this is the "make the change easy" prefactor for everything else.

## Acceptance criteria
- [x] Fresh clone on Linux/macOS: `make up` → all three services healthy in < 60 s; `mc ls` shows `raw` and `public`; `mc ilm ls` on `raw` shows *expire 7 d* and *abort incomplete multipart 1 d*; anonymous `GET /public/missing` returns 404 (policy applied, not 403).
- [x] `make check-redis` asserts `maxmemory-policy = noeviction` and AOF enabled; the default `.env.example` values connect to everything unchanged.
- [x] `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test` green in < 2 min; second `pnpm turbo run build` is a full cache hit.
- [x] The `apps/worker` smoke test passes under both `vitest` and `bun test` (runtime parity gate exists from day one).
- [x] `make up` twice is a no-op; `make nuke && make up` recovers; `make down/logs/psql/redis-cli/mc` targets work.
- [x] Root scripts: `dev`, `build`, `test`, `test:integration`, `lint`, `format`, `typecheck`, `clean`; TypeScript strict + `noUncheckedIndexedAccess`, ESM, Node 24 / Bun 1.4 pinned.

## Out of scope
CI (02), fixtures/tooling (03), app services in compose (08), observability profile (21).

## Notes for the implementer
- Install pnpm via `npm i -g pnpm@10` in docs and later in images (do not rely on corepack).
- Libraries build with plain `tsc` — no bundler — to keep Node/Bun parity trivial.
- Keep a `REDIS_IMAGE` variable so `valkey/valkey:8` can be swapped in later (ADR-05).

## Testing plan
Smoke tests only, plus `infra/compose/test.sh` that exercises the AC above (reused by 02 in CI).

## Open questions
- Turborepo remote cache: defer; local cache suffices through Phase 2.

## Definition of Done
- [x] All AC green locally; README quick start written; merged to `main` and tagged `phase0-start`.
