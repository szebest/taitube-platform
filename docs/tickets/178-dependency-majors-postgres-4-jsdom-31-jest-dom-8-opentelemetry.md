# 178: Dependency majors - postgres 4, jsdom 31, jest-dom 8 and the OpenTelemetry 0.3 line

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M (one PR per package group) |
| Blocked by | None (can start immediately) |
| Blocks | — |
| Spec | [34 Node 26 upgrade](34-node26-upgrade-deps.md) (does not cover these) · [SDD toolchain](../SDD.md#152-toolchain) |

**Status:** ready

## What to build

Take the four majors the repo is behind on, each in its own commit so a failure bisects to one package:

| Package | In the repo | Where |
|---|---|---|
| `postgres` | `^3.4.9` | `packages/server/adapters`, `packages/server/db` |
| `jsdom` | `^30.1.2` | every package and app that runs a jsdom project (18 `package.json` files) |
| `@testing-library/jest-dom` | `^7.0.1` | the client packages and both apps |
| `@opentelemetry/*` experimental line | `^0.223.0` (`sdk-node`, `exporter-trace-otlp-http`, `instrumentation`, `instrumentation-fetch`), `auto-instrumentations-node ^0.81.0`; the stable `2.x` and `api 1.x` packages ride along | `packages/platform/server/observability`, `packages/platform/client/web-telemetry`, `apps/server/api`, `apps/server/worker` |

Latest on 2026-11-27 by `npm view`: postgres 4.1.1, jsdom 31.0.1, jest-dom 8.0.0, sdk-node 0.301.2. Those numbers are a snapshot: check each with `npm view <pkg> version` at pickup and take the current latest major, not these.

[34](34-node26-upgrade-deps.md) is a separate ticket: it moves Node to 26 and Bun, and says only "`pnpm outdated` clean for majors we chose to take" with no package named. It does not name `@types/node`, and it is date-gated. This ticket does not wait for it unless a major here requires Node 26; if one does, say so in the PR and block on 34 then.

For OpenTelemetry the exporter and auto-instrumentation set is reviewed, not only bumped: the 0.2xx to 0.3xx jump moves several packages together, so read the changelog for `sdk-node`, `auto-instrumentations-node` and the OTLP exporter, drop an instrumentation the repo does not use, and keep the packages on one line (a mixed `0.223` and `0.301` tree breaks the peer ranges).

## Acceptance criteria

- [ ] Each package is on its latest major (checked with `npm view` at pickup), in every `package.json` that lists it, and the lockfile has one version of each.
- [ ] `postgres` 4: the adapter and `packages/server/db` compile and pass the Postgres contract suites against the compose database, including the CAS and fencing helpers and the outbox; `make smoke` stays green. Any changed option (`prepare`, `types`, `transform`, connection settings) is recorded in the PR.
- [ ] `jsdom` and `jest-dom`: every jsdom project passes under `vitest`, `vitest.jsdom.config.ts` still proves a universal package in a browser, and no spec needed a new polyfill (if one did, the PR says which and why).
- [ ] OpenTelemetry: traces still reach Tempo end to end (the check ticket 23 added), metrics and the `instrument.ts` import hook work on Node, and the worker's Bun image still starts, since it has no module hooks.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` and the `e2e-smoke` job are green; CI cycle time does not regress (rule 11).
- [ ] `docs/SDD.md` fact sheet and toolchain rows carry the new versions and the date.
- [ ] A package that cannot move yet (a peer that has not caught up) is left on its major with a dated note in the ticket's *Open questions*, not skipped silently.

## Setup & environment

None. No env keys change; if an OpenTelemetry default changes an `OTEL_*` behaviour, `packages/server/env-schema` and `.env.example` follow in the same PR.

## Out of scope

- Node 26, `@types/node` 26, Bun, BullMQ, Fastify and Drizzle: ticket 34.
- Replacing a dependency with another library.
- Dev tooling majors (oxlint, vitest, vite): not named by the audit that raised this.

## Notes for the implementer

- Raised by the status and loose-ends audit (2026-11-27).
- Rule 4: `postgres` is imported only in `packages/server/adapters/**` and `packages/server/db/`; the bump must not move an import.
- The `@kit` platform packages (`observability`, `web-telemetry`) hold the OpenTelemetry dependencies; see `packages/AGENTS.md` for what a `@kit` package may depend on.
- Version ranges follow the repo's current style (caret on the new major).

## Testing plan

The existing suites are the proof. Add a test only where a major changes behaviour the repo relied on and nothing covered.

## Open questions

- None.

## Definition of Done

- [ ] Merged; SDD updated; `gen-index.py` re-run.
