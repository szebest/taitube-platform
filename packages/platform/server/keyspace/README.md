# @kit/keyspace

The wire format of a server-sent event stream: the frame a connection writes and the comment that keeps it
open.

```sh
pnpm add @kit/keyspace
```

Tokens and registries: none.

```ts
import { formatSseFrame, SSE_PING_COMMENT } from '@kit/keyspace';

response.write(formatSseFrame({ id: 7, event: 'status', data: { state: 'ready' } }));
response.write(SSE_PING_COMMENT);
```
