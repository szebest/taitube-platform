# AGENTS.md — @vp/queries (the data layer both client apps share)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [53](../../../docs/tickets/53-frontend-architecture-modernization-tanstack-query.md). `client` tier,
layer T5, the app-module layer: it sits on `@vp/api-client` (T4) and below the apps (T6).

## What it holds

- `createQueryClient()`: one per request on the server and one per tab, a `staleTime` above zero so hydration
  never refetches, no retry on the server and none for a 4xx in the browser.
- `createAppApiClient(baseUrl)`: the typed client with the viewer's stored token. Each app builds it once in its
  `getRouter`, from its own `src/config`, and puts it in router context; `ApiProvider` and `useApi()` hand the
  same client to components. `useApi()` outside the provider throws, naming it.
- Today's auth seam: `readAuthToken`, `clearAuthToken` (the dev token in `localStorage`) and `Session` /
  `guestSession()` for router context. 56 replaces it with a cookie session.
- Loader helpers: `ensureFound` (an API 404 renders the not-found page), `parseParam` (a segment its schema
  refuses renders it too), `keysetPaging` and `KEYSET_PAGE_SIZE`.
- The query factories both apps read, each taking the client: `videoQueryOptions(api, id)`,
  `myVideosQueryOptions(api)`, `accountQueryOptions(api)`, and `videoKeys`.

## Rules

- **A factory takes the client as its first argument**; nothing here builds one or reads app config.
- **A factory moves here when a second app reads it**, and not before: a query only web reads (feed, channel,
  reactions, subscriptions, categories) stays in web's `features/`.
- **No React component and no UI.** `ApiProvider` is the one provider, and it holds nothing but the client.

## What does not belong here

- An app's mutations and their cache choreography (`useSetReaction`, `useUploadVideo`): they live with the
  app feature that triggers them.
- Anything that reads `import.meta.env` or an app's `src/config`.

```bash
pnpm --filter @vp/queries typecheck
pnpm --filter @vp/queries test
```
