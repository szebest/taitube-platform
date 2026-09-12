# 53: Frontend architecture modernization — TanStack suite (Query, Form, Table), typed API client & state cleanup

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#53](https://github.com/szebest/taitube-platform/issues/53) |
| Size | L |
| Blocked by | 51 — Type-safe query client · 52 — Frontend monorepo integration |
| Blocks | 54, 55, 57, 67, 68, 69, 70, 72, 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

The imported legacy frontend code suffered from several classic frontend anti-patterns:
1. Direct, untyped `axios` / `fetch` calls scattered across React components with manual `useEffect` chains.
2. Race conditions on fast route navigation and lack of automatic query deduplication.
3. Brittle in-memory state with no cache invalidation strategies when mutations occurred (such as liking a video or adding a comment).
4. Fragile form state with manual controlled inputs and untyped error validations.
5. Inflexible, un-paginated UI tables lacking headless sorting, filtering, and selection capabilities.

This ticket establishes the **Unified TanStack Architecture** across state, data-fetching, forms, and tables:
1. **Tooling & Foundation**:
   - Upgraded to **React 19**, **Tailwind CSS v4**, and strict **TypeScript 5.7+**.
2. **Type-Safe API Client with Zod Validation**:
   - Centralized HTTP client (`apps/web/src/lib/api-client.ts`) utilizing shared DTO schemas from `@taitube/api-contracts`.
   - Automatic injection of Authorization headers with refresh handling.
   - RFC 9457 Problem Details error interceptor that translates backend machine-readable codes into user-friendly UI toasts.
3. **TanStack Query (React Query v5)**:
   - Declarative data-fetching hooks for all core resources: `useVideo(id)`, `useFeed(category, cursor)`, `useComments(videoId)`, `useReactions(videoId)`, `useChannel(handle)`.
   - Optimistic updates for engagement: liking/disliking immediately updates the local UI counter and reverts cleanly if the network request fails.
   - Smart cache keys (`['videos', id]`, `['feed', category]`) and fine-grained invalidation on mutations.
   - Dehydration/hydration infrastructure ready for TanStack Start SSR loaders.
4. **TanStack Form (`@tanstack/react-form` + `@tanstack/zod-form-adapter`)**:
   - Standardizes all user inputs on type-safe, reactive TanStack Form primitives with zero unnecessary component re-renders.
   - Direct integration with `@taitube/api-contracts` Zod validation schemas for field-level and form-level errors.
5. **TanStack Table (`@tanstack/react-table` v8)**:
   - Headless table infrastructure providing type-safe sorting, filtering, column visibility, and row selection for tabular views.
6. **Zustand v5 Lightweight Client UI State**:
   - Replaces convoluted Redux / Prop-drilling with a minimalist Zustand v5 store for client-only transient state: active audio volume/preferences and UI sidebar toggle.

## Acceptance criteria

- [ ] React 19, TanStack Query v5, TanStack Form, and TanStack Table installed and configured.
- [ ] TanStack Query configured with `QueryClientProvider`, `staleTime: 60_000`, `gcTime: 300_000`, and SSR dehydrate/hydrate support.
- [ ] Centralized API client module with typed request/response wrappers.
- [ ] Refactored feed and video detail pages using `useQuery` / `useInfiniteQuery`.
- [ ] Optimistic mutation hooks:
  - `useLikeVideoMutation` optimistically toggles like state and updates counts in cache before server responds.
  - `useCreateCommentMutation` prepends pending comment to comment list and invalidates upon server 201 response.
- [ ] Reusable TanStack Form field wrappers created with accessible error messages and Zod validation.
- [ ] Reusable headless table components configured with `@tanstack/react-table` for data grid views.
- [ ] Toast notification system triggered by API client error interceptor whenever backend returns RFC 9457 error payload.
- [ ] Unit tests for API client error handling, TanStack Form validation, and TanStack Query hooks using Vitest 3 and React Testing Library.

## Out of scope

- Visual redesign of UI components (handled in ticket 54 & 55).
- Server-Side Rendering (SSR) configuration (handled in ticket 56).

## Notes for the implementer

- Keep query key factories organized in `apps/web/src/lib/query-keys.ts`:
  ```ts
  export const videoKeys = {
    all: ['videos'] as const,
    detail: (id: string) => [...videoKeys.all, id] as const,
    comments: (id: string) => [...videoKeys.detail(id), 'comments'] as const,
  };
  ```
- File discipline: Break down hooks into dedicated files under `apps/web/src/hooks/` <= 200 lines each.

## Testing plan

- Unit tests with mock server / `msw` testing optimistic like rollback upon server error.
- Smoke test verifying navigation between pages does not trigger duplicate background network requests.

## Definition of Done

- [ ] `pnpm --filter @taitube/web test` and `pnpm --filter @taitube/web typecheck` pass.
- [ ] No direct unmanaged `useEffect` fetching remains in video playback or feed views.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
