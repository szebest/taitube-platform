# AGENTS.md — @kit/ports (infrastructure ports and their contract suites)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

The abstract classes an app's adapters implement for infrastructure that fails, and the suites that hold every
implementation to the same behaviour. Tier `server`, `vp.layer` 4; its dependencies are in
[package.json](package.json). No SDK and no product value: the app's own ports stay in the app.

- **Ports (`src/`):** `CacheClient`, `DatabaseClient`, `JobQueue` and `FlowProducerPort`, each extending
  `HealthCheckable` and returning the matching `*Unavailable` failure of `@kit/errors`.
- **Contract suites (`src/contract/`, export `./contract`):** `describeCacheClientContract`,
  `describeJobQueueContract` and `describeFlowProducerContract`, each `describeX(makeSubject)`. They use the
  vitest globals, so they run under `vitest` and `bun test`; vitest is a peer dependency.

---

## 2. Invariants

- A port returns its failures as a `Result`; it never throws one.
- A miss or an unknown id is `ok`, never a failure: absence is not unavailability.
- Changing a suite is a change of the surface: version bump and changelog entry.
- Runs unchanged under Node and Bun.

---

## 3. Local Commands

```bash
pnpm --filter @kit/ports typecheck
pnpm --filter @kit/ports test
```
