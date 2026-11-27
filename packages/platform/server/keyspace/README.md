# @kit/keyspace

A typed, frozen layout of cache keys under one namespace, and the wire format of a server-sent event stream: the
frame a connection writes and the comment that keeps it open.

```sh
pnpm add @kit/keyspace
```

Tokens and registries: none. The app passes its namespace to `defineKeyspace`.

```ts
import { defineKeyspace, formatSseFrame, SSE_PING_COMMENT } from '@kit/keyspace';

export const Keys = defineKeyspace('acme', (key) => ({
  catalogue: key('cache', 'catalogue', 'v1'),
  basket: (userId: string) => key('user', userId, 'basket'),
}));

Keys.basket('u-1'); // 'acme:user:u-1:basket'

response.write(formatSseFrame({ id: 7, event: 'status', data: { state: 'ready' } }));
response.write(SSE_PING_COMMENT);
```
