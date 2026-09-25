# 51: Type-safe API client SDK (`@taitube/api-client`) with auto-generated TanStack Query hooks

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#51](https://github.com/szebest/taitube-platform/issues/51) |
| Size | M |
| Blocked by | None - absorbed by 82, 53, 54 and 70 |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §6.2 Error codes](../SDD.md#62-error-codes-stable-machine-readable) |

**Status:** done

## Absorbed

The client exists and the hook layer is a pattern, not a package:

- `createApiClient({ baseUrl, getAuthToken })` in `@vp/api-client` (ticket 82) already derives its endpoints
  from `@vp/api-contracts` and parses problem+json into typed errors.
- Query options and query keys live in feature folders next to their feature, following the pattern
  [89](89-web-tanstack-start-foundation.md) sets and [53](53-frontend-architecture-modernization-tanstack-query.md) applies everywhere.
- `toViewState(result)` from the ticket 84 note: [53](53-frontend-architecture-modernization-tanstack-query.md).
- Retry and backoff policy: [70](70-frontend-resilient-error-handling-retry-policy.md).
- MSW handlers typed from the contracts: [54](54-frontend-testing-trophy-vitest-msw-integration-suite.md).
