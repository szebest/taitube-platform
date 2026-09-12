# 51: Type-safe API client SDK (`@taitube/api-client`) with auto-generated TanStack Query hooks

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 50 — Shared API contracts |
| Blocks | 53 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §6.2 Error codes](../SDD.md#62-error-codes-stable-machine-readable) |

**Status:** blocked

## What to build

Consuming REST APIs on the frontend is traditionally plagued by repetitive boilerplate: creating fetch wrappers, manually typing query params, managing URL templates (`/v1/videos/${id}`), and synchronizing TanStack Query key arrays.

This ticket delivers an automated, **End-to-End Type-Safe API Client SDK**: **`packages/api-client`** (`@taitube/api-client` or `@taitube/api-client`):

1. **Fully Typed Fetch Client (tRPC-like ergonomics for REST)**:
   - Built on top of `openapi-fetch` or lightweight fetch wrapper typed by `@taitube/api-contracts`.
   - Autocompletes route paths, method types, path parameters, query parameters, and returns strictly typed response objects:
     ```ts
     // TypeScript auto-completes the path, params, and knows data is VideoDto:
     const { data, error } = await client.GET('/v1/videos/{id}', {
       params: { path: { id: videoId } }
     });
     ```
2. **Auto-Generated TanStack React Query Hooks**:
   - Generates typed React Query hooks (`openapi-react-query` or custom proxy query factory):
     - `useVideoQuery({ id })`
     - `useFeedInfiniteQuery({ categoryId })`
     - `useCreateCommentMutation()`
   - Guarantees 100% type-safe query keys, caching, and invalidation without human typos.
3. **Resilient Network & Error Handling**:
   - Built-in automatic exponential backoff on network timeouts or 503 Service Unavailable.
   - Transparent authentication token attachment via configurable `authProvider`.
   - Native RFC 9457 Problem Details error objects passed directly to TanStack Query's `error` state.

## Acceptance criteria

- [ ] Monorepo package `packages/api-client` created and linked in `pnpm-workspace.yaml`.
- [ ] Direct dependency on `@taitube/api-contracts`.
- [ ] Exported `createApiClient({ baseUrl, getAuthToken })`:
  - Full TypeScript type-safety on all HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`).
  - Automatic `Content-Type: application/json` and `Accept: application/json, application/problem+json` headers.
  - Automatic parsing of RFC 9457 `ProblemDetails` on 4xx/5xx responses.
- [ ] Exported React integration `@taitube/api-client/react`:
  - Pre-built typed query hooks and mutation hooks wrapping TanStack Query v5.
  - Type-safe query key helpers: `queryKeys.videos.detail(id)`.
- [ ] Zero bundle bloat: Tree-shakeable exports with total package size under 15 KB.
- [ ] Integration tests using MSW (Mock Service Worker) asserting typed responses, query param encoding, and error classification.

## Out of scope

- Direct UI components (kept strictly in `apps/web`).

## Notes for the implementer

- Keep package modular and strictly decoupled from React DOM or specific UI frameworks so it can also be used by CLI tools or future mobile apps.
- Implement proper dual runtime exports (`import` / `require` / TypeScript `.d.ts`).

## Testing plan

- Typecheck test: TypeScript compilation asserts error if a non-existent path or wrong param type is passed to `client.GET()`.
- MSW test: Mock Fastify responses and assert query hook returns matching data type.

## Definition of Done

- [ ] `pnpm --filter @taitube/api-client test` and `pnpm --filter @taitube/api-client typecheck` pass.
- [ ] Client successfully consumed by `apps/web`.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
