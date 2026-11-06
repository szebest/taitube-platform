# 138: Type-aware lint backlog, the twelve oxlint rules 110 left off

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M (one PR per rule group, about four) |
| Blocked by | 110 - Oxc and Vite+ toolchain |
| Blocks | — |
| Spec | [SDD ADR-30 Toolchain: Oxc and Vite+](../SDD.md#adr-30--toolchain-oxc-and-vite) · [lint.config.ts](../../lint.config.ts) |

**Status:** blocked

> **Why.** 110 turned type-aware oxlint on, but twelve of its correctness rules already had findings, so they sit in
> `TYPE_AWARE_BACKLOG` in `lint.config.ts`, switched off. Each one catches a real class of bug (a promise nobody
> awaits, a method torn off its object, a `String(object)` that prints `[object Object]`), and every week they stay
> off, new code adds to the count. This ticket clears each rule's findings and moves it out of the backlog list, so
> the list ends empty and the one lint config enables them with nothing else changing.

## Today (slice b of 110, 2026-11-06)

Counted with the twelve rules turned on over the repo's lint scope (`.agents`, `.claude` and `docs` left out):

| Rule | Findings | Where they are |
|---|---|---|
| `typescript/unbound-method` | 394 | `apps/client/web` 201, `apps/client/studio` 113, `@vp/messages` 51, `@vp/intl` 9 |
| `typescript/consistent-type-exports` | 59 | `@vp/core` 33, `@vp/permissions` 14, `@vp/domain` 7, `@vp/adapters` 3 |
| `typescript/no-floating-promises` | 52 | `apps/client/web` 30, `apps/client/studio` 10, `@vp/components` 4, `apps/server/worker` 3 |
| `typescript/no-base-to-string` | 12 | `apps/server/api` 4, `apps/client/studio` 2, `@vp/api-client` 2 |
| `typescript/no-redundant-type-constituents` | 11 | `@vp/intl` 3, `@vp/errors` 3, `@vp/api-contracts` 3, `@vp/ffmpeg` 2 |
| `typescript/no-useless-default-assignment` | 9 | `@vp/adapters` 6, `scripts` 2, `apps/client/studio` 1 |
| `typescript/restrict-template-expressions` | 9 | `apps/client/web` 7 |
| `typescript/prefer-optional-chain` | 4 | `@vp/adapters` 2 |
| `typescript/no-misused-spread` | 4 | `@vp/ffmpeg` 2, `apps/server/worker` 1, `apps/client/web` 1 |
| `typescript/await-thenable` | 2 | `apps/server/api` 1, `@vp/adapters` 1 |
| `typescript/require-array-sort-compare` | 2 | `apps/server/api` 1, `@vp/web-telemetry` 1 |
| `typescript/no-implied-eval` | 1 | `@vp/ui` 1 |

The server hotspots come first, because a finding there sits on a job or a write path, not a render:
`apps/server/worker` (three floating promises and a misused spread) and `@vp/adapters` (six useless defaults, two
optional chains, one awaited non-promise, three type re-exports).

## What to build

1. **Worker and adapters first.** Fix every finding of the twelve rules in `apps/server/worker` and
   `packages/server/adapters`, each floating promise either awaited or handed to the `ignore`/`fromPromise` helpers
   from `@vp/result` with its reason, never a bare `void`.
2. **The small rules.** `await-thenable`, `require-array-sort-compare`, `no-implied-eval`, `no-misused-spread`,
   `prefer-optional-chain`, `no-useless-default-assignment`, `restrict-template-expressions`, `no-base-to-string` and
   `no-redundant-type-constituents`: fix the findings, drop each from `TYPE_AWARE_BACKLOG`.
3. **`consistent-type-exports`**: `export type` where a re-export carries only types; mechanical.
4. **`no-floating-promises`** in the client apps: a mutation or navigation promise is awaited, or ignored through
   `ignore` with the reason.
5. **`unbound-method`** last: most findings are methods passed as callbacks (`tOr`, query helpers); bind them through
   an arrow or make the method an arrow property where the class owns it. A rule whose findings turn out to be false
   positives on this codebase stays off, with the count and one example in ADR-30.

Each step removes its rules from `TYPE_AWARE_BACKLOG` in the same commit, and `lint.config.ts` stays one file.

## Acceptance criteria

- [ ] `TYPE_AWARE_BACKLOG` is empty or each rule left in it is named in ADR-30 with its count and why it stays off.
- [ ] `pnpm lint` is clean with the rules on; `scripts/__tests__/lint-config.test.ts` proves one of them fires.
- [ ] No finding is silenced with an `oxlint-disable` without a reason on the same line.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm test:architecture` and `pnpm knip` pass.

## Out of scope

- Rules outside the type-aware correctness set, and `typeCheck` (ticket 94).

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] ADR-30's backlog paragraph updated with what is left.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
