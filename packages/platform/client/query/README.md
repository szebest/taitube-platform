# @kit/query

The TanStack Query pieces every client app wants, with the app's failure vocabulary left to the app: a query client
factory, a retry policy, keyset paging, loader helpers that turn a missing resource into the not-found page, and a
single-flight session refresh.

```sh
pnpm add @kit/query @tanstack/react-query @tanstack/react-router react zod
```

Tokens: none. Registries: none. The app passes the classifier, the missing predicate and the session refresh as arguments.

The app says which failures are worth retrying and which one means "missing"; the package holds no error codes.

```ts
import { createEnsureFound, createQueryClient, createRetryPolicy } from '@kit/query';

const retryPolicy = createRetryPolicy({
  classify: (error) => (error instanceof HttpError && error.status < 500 ? 'permanent' : 'transient'),
  retryAfterMs: (error) => (error instanceof HttpError ? error.retryAfterMs : undefined),
});

export const queryClient = () => createQueryClient(retryPolicy);
export const ensureFound = createEnsureFound((error) => error instanceof HttpError && error.status === 404);
```

Feeds page with `keysetPaging` and `KEYSET_PAGE_SIZE`; `parseParam(schema, segment)` throws not-found for a segment
its schema refuses; `singleFlightRefresh(refresh)` shares one refresh between parallel calls that were refused the
same token.
