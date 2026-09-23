# 88: Test correspondence burn-down — the sources the 1:1 rule was never applied to

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 87 — One composition root, a typed container and configuration as a value |
| Blocks | — |
| Spec | [SDD ADR-19 Hexagonal architecture](../SDD.md#adr-19-hexagonal-architecture-interface-segregation-and-modular-repository-boundaries) · [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23-package-runtime-tiers-the-directory-is-the-tier) · [SDD ADR-24 Result-typed error handling](../SDD.md#adr-24-result-typed-error-handling-domain-returns-the-edge-decides) · [SDD §15.1 Repository layout](../SDD.md#151-repository-layout-monorepo-video-pipeline) |

**Status:** blocked

---

## Why this ticket exists

`CLAUDE.md` rule 12 calls grouping tests for several sources into one bundled file "a strict architectural
violation". `tests/architecture/test-correspondence.test.ts` enforces it. And
`tests/architecture/untested-sources.ts` exempts **188 of 488 production sources** — 39% — from the rule it
enforces.

The list is shrink-only, which is the right mechanism: it can never grow, and an entry that stops breaching
fails the build until it is removed. What it cannot do is shrink by itself. It has been at 188 since ticket 82
made the rule executable, and ticket 84 did not move it.

[87](87-composition-root-typed-container-config-value.md) takes two bites: the 31 declaration-only entries
(pure `type`, `interface` and `abstract class`, where the rule over-reached rather than the code under-tested)
and the ~19 files it rewrites. This ticket takes what is left.

### What is left, and why each part is different

| Area | Entries | Why it has no spec | What a spec has to do |
|---|---|---|---|
| `packages/server/adapters/postgres` | 15 | Drizzle query building; the in-memory double was tested instead | assert the SQL shape and the CAS/fencing contract against a real Postgres in the `integration` job |
| `packages/server/adapters/in-memory` | 19 | treated as test infrastructure, so nobody tested the test infrastructure | fidelity: the double and the real adapter must answer the same way, which is one shared contract suite run twice |
| `packages/server/adapters` (s3, redis, bullmq) | ~39 | SDK-heavy; the 82 review measured 2,074 untested lines here | contract suite against MinIO and Redis, already available in the `integration` job |
| `apps/web` | 55 | 140 production files, 9 spec files — 6% | see *Scope* below; most of this is 49-75's problem, not this ticket's |
| everything else | ~10 | scripts, CLIs, one-off helpers | a real spec or a deletion, per file |

**The in-memory row is the one that matters most.** Nineteen doubles carry the fidelity of every unit test in
the repo, and nothing checks that they behave like the thing they stand in for. A double that drifts does not
fail — it makes a suite pass that should not. One shared contract suite, run once against the double and once
against the real adapter, is worth more than nineteen separate specs and is how the 15 Postgres and ~39
SDK-adapter entries get paid for at the same time.

---

## Scope

**Server-side only: `packages/server` (73) and the residual scripts and CLIs (~10).** Target: the list reaches
**≤ 55 entries**, all of them `apps/web`, and correspondence reaches **≈89%** of server-side sources.

`apps/web` stays on the list. Its 55 entries are React 18 + Create React App code that tickets 53-55 replace
outright, and 54 builds the frontend testing infrastructure (Vitest 3, Testing Library, MSW) that any spec
written here would have to be rewritten against. Writing specs now for components that 55 deletes is the
clearest case of testing a behaviour another ticket will change. **This ticket lowers the ceiling to
`apps/web`; ticket 54 removes it.**

---

## What to build

### W1 — One port contract suite, run against both adapters

For each port in `@vp/core/ports` and each repository in `@vp/core/repositories`, a single exported suite that
takes a factory and asserts the contract: ordering, absence, idempotency, the `Result` error variants each
method may return (ADR-24), and the CAS/fencing guarantees. `packages/server/testing` owns it. The in-memory
double and the concrete adapter each run it — the double in the `unit` job, the concrete one in `integration`.

A drifted double becomes a failing test instead of a passing lie. This is also the cheapest path through the
largest three rows of the table above.

### W2 — Per-adapter specs for what the contract cannot express

Query shape, presign parameters, multipart part sizing, BullMQ job options, pub/sub channel names. One file per
source, named after it, as rule 12 requires.

### W3 — The residue

Scripts, CLIs and helpers: a real spec, or a deletion if nothing imports it. Report the dead ones rather than
quietly removing them.

### W4 — Lower the ceiling

`untested-sources.ts` holds `apps/web` entries and nothing else. Add a comment naming ticket 54 as the owner,
and a line in `docs/standards/testing.md` saying the list is now a frontend-only debt with a named owner rather
than an open-ended exemption.

---

## Acceptance criteria

- [ ] `untested-sources.ts` is **≤ 55 entries**, every one under `apps/web`. Quote before and after.
- [ ] One contract suite per port and per repository, run against both the double and the concrete adapter; a fixture proves it fires when a double drifts from the adapter.
- [ ] `pnpm test` and `pnpm test:bun` green; the `integration` job green against real Postgres, Redis and MinIO.
- [ ] No spec asserts only that a module imports, and none tests a mock. Both are review-blocking.
- [ ] `pnpm test` wall-clock regression stated and justified. Adding ~130 specs will cost something; say how much and where it lands (`unit` vs `integration`).
- [ ] `docs/standards/testing.md` records the contract-suite pattern as the way a port is tested here.
- [ ] No other shrink-only list grows.

---

## Out of scope

- **`apps/web`.** Owned by 53, 54 and 55. This ticket names the owner; it does not write React specs against a
  stack that is being replaced.
- **Coverage thresholds.** A percentage gate is a different mechanism with different failure modes, and the 1:1
  rule is the one this repo chose.
- **Changing any production behaviour.** A spec that needs a source changed to become testable means the source
  is the ticket, and it gets its own.

---

## Notes for the implementer

- Write the contract suite before any per-adapter spec. If it is right, W2 shrinks a lot; if it is written last,
  W2 gets written twice.
- The 82 review measured 2,074 untested lines across s3 + redis + bullmq. That is the number to quote against.
- Deleting a dead source is a better outcome than a spec for it. Look for that first in W3.

---

## Definition of Done

All acceptance criteria ticked with pasted evidence · branch `ticket/88-test-correspondence-burn-down` · PR
reviewed and approved · all CI checks green · `**Status:** done` and `python3 docs/tickets/gen-index.py` re-run
· `docs/standards/testing.md` updated in the same PR · no new external runtime dependency.
