# AGENTS.md - @vp/machine (lifecycles as tables)

Instructions for any coding agent working on `@vp/machine`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/machine` turns a lifecycle into data: `defineMachine({ name, states, initial, final, events })` holds the
legal moves as a typed table, keyed by event, each edge `{ from, to, event? }`. It answers one question,
"is this edge legal from this state": `next(state, event)` (a state or `undefined`), `sources(event)`,
`target(event)` and `matrix()`. `machineFindings` lists structural faults (unreachable state, dead non-final
state, final state with an exit, event with no source) and `toMermaid` draws the table.

It knows nothing about `ErrorCode`, `Result`, a video or a comment. A miss is `undefined`; the rule that
consults the table in `@vp/domain-rules` maps it to its own failure, adds the guards that depend on input
(a reason, a lock) and returns the `Result`. The CAS helper persists the move. Definitions live in
`*.machine.ts` files next to that rule; the authority is
[docs/state-machines.md](../../../docs/state-machines.md).

---

## 2. Invariants

- **Zero runtime dependencies.** T1 universal, `vp.layer` 1, `"sideEffects": false`. It must run unchanged in a
  browser, under `vitest` and under `bun test`.
- **Data, not an interpreter.** No actors, timers, listeners or guards here. A guard that needs input stays in
  the rule.
- **A state or event outside the table does not compile.** `src/__tests__/type-fixtures/define-machine.ts`
  holds the `@ts-expect-error` proofs, so `pnpm --filter @vp/machine typecheck` is part of its test suite.
- Every source file except the `index.ts` barrel has its own `__tests__/<name>.test.ts`.

---

## 3. Local Commands

```bash
pnpm --filter @vp/machine typecheck
pnpm --filter @vp/machine test
bun test packages/universal/machine
```
