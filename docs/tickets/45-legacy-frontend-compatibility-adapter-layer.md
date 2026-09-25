# 45: Frontend API modernization & contract alignment — migrate web app to clean canonical `/v1` APIs

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#45](https://github.com/szebest/taitube-platform/issues/45) |
| Size | L |
| Blocked by | None - absorbed by 82, 53, 59 and 70 |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** done

## Absorbed

The backend stayed on canonical `/v1` with no legacy shims, and the frontend side of this ticket is already
true or owned elsewhere:

- Every web call already goes through the contract-derived `apiClient` (`@vp/api-client` over
  `@vp/api-contracts`, ticket 82) on `/v1`, including the presigned upload flow, reactions and subscriptions.
- Moving the remaining RTK Query endpoints to TanStack Query: [53](53-frontend-architecture-modernization-tanstack-query.md).
- Consuming keyset-paginated threaded comments: [59](59-video-watch-page-responsive-layout-enhancements.md).
- Presenting RFC 9457 problem+json failures to the user: [70](70-frontend-resilient-error-handling-retry-policy.md).
