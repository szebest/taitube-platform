# 70: Frontend resilient error handling — RFC 9457 error pages, classified query retry policies & contextual view fallbacks

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#70](https://github.com/szebest/taitube-platform/issues/70) |
| Size | M |
| Blocked by | 53 — Frontend architecture modernization · 54 — Frontend testing infrastructure · 55 — Modern design system foundation |
| Blocks | 75 |
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

A resilient, production-grade video platform must handle failures with precision, clarity, and grace. Unhandled exceptions, infinite query retries on permanent errors, or catastrophic page crashes due to a secondary widget failure destroy trust.

This ticket delivers the **Frontend Resilient Error Handling & Retry Architecture**:

1. **Classified Query & Mutation Retry Engine (`apps/web/src/lib/query-client.ts`)**:
   - **Idempotent Query Retry Policy:** TanStack Query auto-retries read-only queries (GET) up to 3 times with exponential backoff and randomized jitter:
     ```ts
     retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000) * (0.8 + Math.random() * 0.4)
     ```
   - **Strict Mutation Safeguard:** Mutations (POST, PUT, PATCH, DELETE) have `retry: false` by default. Auto-retrying mutations on server 5xx risks duplicate side-effects (e.g. creating duplicate comments, charging twice, or issuing duplicate channel subscriptions). Mutations only retry on explicit user action or automatic online reconnection.
   - **Failure Classification (ADR-18 Parity):**
     - **Permanent Errors (4xx: 400, 401, 403, 404, 409, 422):** Never retry (`retry: false`). Immediately display domain error details or route to the appropriate error page.
     - **Rate Limiting (429):** Reads `Retry-After` header if available, or enforces a minimum 5-second backoff delay.
     - **Transient Errors (500, 502, 503, 504, or network drops like `TypeError: Failed to fetch`):** Retry up to 3 times.
   - **Online / Offline Network Sync:** Automatically listens to browser connectivity (`window.addEventListener('online')`), immediately pausing retries when offline and resuming the query cache once network connectivity is restored.

2. **Hierarchical Error Boundaries & Route-Level Error Pages**:
   - **Root Crash Boundary (`<RootErrorPage />`):** Catches unhandled React render crashes and catastrophic lifecycle errors. Displays an obsidian dark theme fallback with a helpful illustration, dev-only error trace, "Reload Application" button, and "Return to Home".
   - **Dedicated Route-Level Error Pages (TanStack Router `defaultErrorComponent` / `notFoundComponent`):**
     - **404 Not Found (`<NotFoundRoute />`):** Rendered when navigating to a non-existent video, deleted channel, or invalid route. Features a broken film reel / retro TV static SVG, clear messaging ("The video or channel you are looking for has vanished or does not exist"), and navigation shortcuts ("Explore Trending", "Return to Home").
     - **403 Forbidden (`<ForbiddenRoute />`):** Rendered when accessing private videos without ownership, creator studio without channel identity, or administrative controls. Features an obsidian shield/lock graphic and request access / switch account actions.
     - **500 Server Error (`<ServerErrorRoute />`):** Rendered when primary page data fails all retries. Features a friendly hiccup illustration with a prominent "Try Again" CTA.

3. **Contextual View-Level Error Components (`<QueryErrorCard />`, `<InlineErrorAlert />`)**:
   - **Critical vs Non-Critical Section Isolation:**
     - On the Video Watch Page, the video player (`<TaitubePlayer />`) is **critical**, while comment threads and recommended video sidebars are **non-critical**.
     - If comment queries fail, the video player MUST continue streaming video uninterrupted! The comment section renders a localized `<QueryErrorCard title="Unable to load comments" onRetry={refetch} />`.
     - If recommended videos fail, the sidebar renders a compact error placeholder without disturbing the main player viewport.
     - If the public home feed fails, it renders a centered, styled feed error card with an immediate "Retry Loading Videos" button.
   - **Mutation Error Rollback & Toast Notification:**
     - When optimistic mutations fail (liking a video, subscribing to a channel, posting a comment), the optimistic cache is cleanly rolled back using TanStack Query context snapshots.
     - A non-intrusive Sonner toast notification appears with the error message and an inline "Retry" action, keeping the user's comment draft text intact in the input box.

## Acceptance criteria

- [ ] TanStack Query client configured in `apps/web/src/lib/query-client.ts` with domain-classified retry logic.
- [ ] Queries retry at most 3 times with exponential backoff and jitter on transient 5xx / network failures, and zero retries on 4xx.
- [ ] Mutations configured with `retry: false` to guarantee idempotency and avoid duplicate server side-effects.
- [ ] Root error boundary implemented in `apps/web/src/components/errors/root-error-page.tsx` catching uncaught rendering exceptions.
- [ ] Route error components created and registered with TanStack Router:
  - `<NotFoundRoute />` for 404 (with retro film graphic and navigation quick links).
  - `<ForbiddenRoute />` for 403 (with security shield graphic).
  - `<ServerErrorRoute />` for 500 (with refresh / retry trigger).
- [ ] Reusable `<QueryErrorCard />` component implemented in `apps/web/src/components/ui/error-card.tsx` with error message, RFC 9457 error code, and `onRetry` button.
- [ ] Sectional error isolation: Video Watch Page isolates comment thread and recommendations inside local error boundaries; failures in secondary widgets do not crash the `<TaitubePlayer />`.
- [ ] Optimistic mutation failures gracefully roll back query cache snapshots and display toast alerts with action retry.
- [ ] Vitest & MSW integration tests in `apps/web/src/__tests__/error-handling.integration.test.tsx`:
  - Transient 503 triggers exactly 3 retries before error display.
  - Permanent 404 immediately renders `<NotFoundRoute />` without retries.
  - Video Watch page remains functional when comments query returns 500.

## Out of scope

- Backend RFC 9457 handler implementations (covered in ticket 19).
- Worker transcoding retry policies (covered in ticket 16).

## Notes for the implementer

- **Error Extraction:** Ensure the query client correctly parses both standard HTTP status codes and RFC 9457 JSON payloads (`application/problem+json`) emitted by the Fastify backend.
- **Draft Preservation:** When comment submission fails, never clear the comment input form. Roll back the optimistic comment entry in the cache while keeping the user's typed text intact.
- **File Length Limit:** Keep all component and error page files <= 250 lines.

## Testing plan

- Mock service worker (MSW) tests simulating 503 Service Unavailable on video queries; verify retry count and exponential backoff timing.
- Mock 404 on `/watch/:id` and assert router renders `<NotFoundRoute />` on initial attempt.
- Component test asserting `<TaitubePlayer />` continues playing while `<QueryErrorCard />` renders inside the comments container.

## Definition of Done

- [ ] All ACs green under `pnpm --filter @taitube/web test` (or `pnpm test`).
- [ ] Architectural docs updated (`ARCHITECTURE.md`, `docs/SDD.md` if boundaries changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
