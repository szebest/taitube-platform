# 70: Frontend resilient error handling — RFC 9457 error pages, classified query retry policies & contextual view fallbacks

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#70](https://github.com/szebest/taitube-platform/issues/70) |
| Size | M |
| Blocked by | 53 - Frontend architecture modernization · 55 - Modern design system foundation · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | — |
| Spec | [SDD ADR-18 Error taxonomy](../SDD.md#adr-18--error-taxonomy-decides-retry-policy) · [SDD §6.2 Error codes](../SDD.md#62-error-codes-stable-machine-readable) · [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

> **Result-typed error handling (ticket 84, SDD ADR-24).** Any service this ticket adds or touches returns
> `Promise<Result<T, E>>` with an **inferred** error union and contains no `throw`, `try` or `catch`. Input
> checks belong in `@vp/validation`, entity-dependent decisions in `@vp/domain-rules`, and routes hand the
> `Result` to `sendResult`. A new error code must land in `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and
> SDD §6.2 together, or it does not compile. Authority:
> [docs/standards/error-handling.md](../standards/error-handling.md).

> **Scope reduced by ticket 84.** The frontend error taxonomy this ticket was going to derive by reading the
> wire format is now an import: `@vp/errors` exports the `Failure` vocabulary and `@vp/validation` /
> `@vp/domain-rules` export the failure unions themselves, both universal. What is left here is the
> *presentation* - `present(failure)` as a total `switch` with `assertNever`, the retry policy, and the
> `ViewState` plumbing. Do not build a second taxonomy.

> **Ticket 85 note:** the user-facing copy for every `ErrorCode` lives in `@vp/messages` as an exhaustive
> `Record<ErrorCode, MessageKey>` — the gap ticket 84 deferred. This ticket renders that copy; it does not
> author error strings inline. See [85](85-universal-intl-formatting-message-core.md).

> **Ticket 84 note — scope reduced.** The failure taxonomy this ticket was going to derive from the wire
> format is now an import: `@vp/validation` and `@vp/domain-rules` expose the discriminated failure
> unions and `@vp/errors`
> exposes `RETRY_CLASS`, so retry policy is read from the shared vocabulary rather than re-classified in the
> browser. What remains here is presentation: error pages, toasts, inline messages, view fallbacks. See [84](84-result-typed-error-handling-shared-domain-rules.md).

## What to build

Presentation of failures on the TanStack Start app from [89](89-web-tanstack-start-foundation.md). The taxonomy,
`RETRY_CLASS` and the copy are imports (see the notes above).

1. **Retry policy in `apps/web/src/integrations/query/`.** The `QueryClient` factory's default `retry` reads
   the failure's `RETRY_CLASS` from `@vp/errors`: permanent never retries, transient retries up to 3 times
   with exponential backoff and jitter, rate limited waits for `Retry-After`. Mutations default to
   `retry: false`. Offline pauses retries (the Query `onlineManager`).
2. **Route error pages.** `errorComponent` and `notFoundComponent` replacing 89's minimal root ones: 404, 403
   and 500 pages rendered from `present(failure)`, a total `switch` over `ErrorCode` with `assertNever`.
   Loaders throw `notFound()` for a missing or private resource, so the server render returns the 404 page
   with a 404 status.
3. **Section boundaries.** Non-critical sections that read with `useSuspenseQuery` (comments, recommendations)
   sit inside their own error boundary with `QueryErrorResetBoundary`, rendering a `QueryErrorCard` with
   retry, so a failing section never takes down the page or the player.
4. **Mutation failures.** A toast (primitive from [55](55-design-system-tailwind-radix-dark-theme.md)) with the
   presented message and a retry action; optimistic rollback stays with the mutation in
   [53](53-frontend-architecture-modernization-tanstack-query.md), and a failed comment keeps its draft.

## Acceptance criteria

- [ ] A transient 503 on a query is retried 3 times then shown; a 404 is shown with no retry; a 429 waits for
      `Retry-After`.
- [ ] Mutations do not retry by default.
- [ ] `/watch/<missing id>` renders the 404 page on the server with status 404; a 403 renders the forbidden
      page.
- [ ] `present` has a case for every `ErrorCode` (adding a code without one fails `typecheck`) and renders
      copy from `@vp/messages`.
- [ ] The watch page stays usable when the comments query returns 500, and the comments card retries on click.
- [ ] A failed mutation shows a toast with retry.

## Out of scope

- Backend problem+json handling ([19](19-videos-api-completion-openapi.md)) and worker retries ([16](16-retries-dlq-admin-replay-reprocess.md)).

## Testing plan

- MSW integration specs from [54](54-frontend-testing-trophy-vitest-msw-integration-suite.md) for the retry counts, the 404 route and the isolated comments section; fake timers for backoff.
- A server render spec for the 404 status.

## Definition of Done

- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint` green.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
