# AGENTS.md — @kit/query (the generic TanStack Query pieces)

> Tier rules for this directory: [../AGENTS.md](../../../client/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

`client` tier. It sits on `@kit/errors` (for the `RetryClass` vocabulary) and `@kit/result`; React, TanStack Query,
TanStack Router and zod are peer dependencies.

## What it holds

- `createQueryClient(policy)`: one per request on the server and one per tab, a `staleTime` above zero so hydration
  never refetches, no retry on the server and the policy's retry in the browser, none for a mutation.
- `createRetryPolicy({ classify, retryAfterMs? })`: `shouldRetry` and `retryDelay` over the app's classifier, three
  retries with full-jitter backoff, or the wait the failure names.
- `createEnsureFound(isMissing)`: a loader helper that runs a query once and turns the failure the app calls
  missing into the router's not-found page.
- `parseParam(schema, raw)`, `keysetPaging` and `KEYSET_PAGE_SIZE`.
- `singleFlightRefresh(refresh)` and the `RefreshSession` type: one refresh per refused token at a time.

## What does not belong here

- An error class, an error code list or a status rule: the app passes the classifier and the predicate.
- A session cookie, a proxy or a route: those are bound to one product.
- A query factory for an entity: it lives with the app.

```bash
pnpm --filter @kit/query typecheck
pnpm --filter @kit/query test
```
