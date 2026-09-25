# 53: Frontend data layer on TanStack Query and TanStack Form - loaders, query options, RTK Query removed

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#53](https://github.com/szebest/taitube-platform/issues/53) |
| Size | L |
| Blocked by | 89 - TanStack Start foundation |
| Blocks | 56, 58, 59, 60, 61, 68, 70, 72 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Result-typed error handling (ticket 84, SDD ADR-24).** Any service this ticket adds or touches returns
> `Promise<Result<T, E>>` with an **inferred** error union and contains no `throw`, `try` or `catch`. Input
> checks belong in `@vp/validation`, entity-dependent decisions in `@vp/domain-rules`, and routes hand the
> `Result` to `sendResult`. A new error code must land in `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and
> SDD §6.2 together, or it does not compile. Authority:
> [docs/standards/error-handling.md](../standards/error-handling.md).

> **Ticket 84 note:** the consumption seam is fixed by ticket 84: a `Result` is unwrapped inline in a
> component (simple, local) or in a hook/presenter (reusable, complex). Two components consuming the same
> `@vp/validation` or `@vp/domain-rules` function may render success and handle failure differently. See [84](84-result-typed-error-handling-shared-domain-rules.md).

## What to build

89 leaves one endpoint (video detail) on TanStack Query and every other legacy page on RTK Query through
`ApiProvider` and `base-api.ts`. This ticket moves the rest and deletes RTK Query. It does not redesign any
page; the legacy components keep their markup and only swap how they get data.

### 1. Queries

- Every RTK Query endpoint in `src/modules/shared/api/` and `src/modules/Upload/api/` becomes a
  `queryOptions` / `infiniteQueryOptions` factory in `src/features/<feature>/api/` (videos, feed, channels,
  account, categories, reactions, subscriptions, upload), with its query key factory beside it.
- Each legacy route's loader calls `queryClient.ensureQueryData(...)` for the page's primary data, and the
  component reads it with `useSuspenseQuery`. Secondary data (my reaction, is-subscribed) stays a plain
  `useQuery` in the component that needs it.
- Keyset feeds use `useSuspenseInfiniteQuery` with the cursor as `pageParam`; `page-merge.ts` goes.
- The `apiClient` instance moves out of `base-api.ts` into `src/integrations/api/`, so 56 has one place to
  attach auth.

### 2. Mutations

- Reactions and subscribe/unsubscribe are optimistic: `onMutate` snapshots and writes the cache, `onError`
  restores it, `onSettled` invalidates.
- Update and delete video invalidate the affected detail and list keys.
- Upload progress is local state of the upload mutation, not a fake `uploadProgress` query.

### 3. Forms

- TanStack Form replaces `react-hook-form` in the legacy upload and edit forms. A `createFormHook` setup in
  `src/integrations/form/` provides the field components, and field validators call `@vp/validation` rules.

### 4. The Result seam

- `toViewState(result)` (the ticket 84 note, carried from 51) lands in `src/hooks/`: it maps a `Result` to
  `{ status, data?, failure? }` for a hook that consumes a rule result. Rules never call it.

### 5. Removal

- `@reduxjs/toolkit`, `react-redux`, `ApiProvider`, `baseApi`, `runApiQuery` and the RTK tag types are gone.
  Client-only UI state (sidebar, theme) stays in its provider; no Zustand, no Redux.

## Delivery slices

1. Read queries: video, channel, account, categories, plus `toViewState`.
2. Public and subscription feeds on infinite queries.
3. Optimistic reactions and subscriptions.
4. Upload and edit on TanStack Form with the upload mutation.
5. Delete RTK Query and its dependencies.

## Acceptance criteria

- [ ] No import of `@reduxjs/toolkit` or `react-redux` remains; both are gone from `apps/web/package.json`, and
      a zero-matches row fails on them.
- [ ] Every legacy route loads its primary data in the loader; navigating between two pages that share a
      query makes no second request for it (spec over the router with a stubbed `apiClient`).
- [ ] Optimistic reaction and subscription mutations roll the cache back when the request fails (spec on a
      `QueryClient` with a failing stub).
- [ ] Upload and edit forms run on TanStack Form with `@vp/validation` validators; `react-hook-form` is gone.
- [ ] `toViewState` has its own spec covering success and each failure shape.
- [ ] No `useEffect` fetching in `src/`.
- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint` green.

## Out of scope

- Router, SSR, `QueryClient` setup, React 19: [89](89-web-tanstack-start-foundation.md).
- Tailwind and visual changes: [55](55-design-system-tailwind-radix-dark-theme.md).
- TanStack Table: [60](60-creator-studio-dashboard-video-management-ui.md) and [61](61-admin-control-panel-category-moderation-ui.md), where the tables are.
- Retry policy and error toasts: [70](70-frontend-resilient-error-handling-retry-policy.md).
- Page-level integration tests on MSW: [54](54-frontend-testing-trophy-vitest-msw-integration-suite.md) and the page tickets.
- Deleting legacy pages: the page ticket that replaces each one.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `apps/web/AGENTS.md` describes the query, mutation and form patterns.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
