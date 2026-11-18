# @kit/keyspace

The wire format of a server-sent event stream: the message envelope a publisher serialises, the frame a
connection writes, and the comment that keeps it open.

```sh
pnpm add @kit/keyspace zod
```

Tokens and registries: none.

```ts
import { formatSseFrame, SSE_PING_COMMENT, SseMessageEnvelope } from '@kit/keyspace';

const envelope = SseMessageEnvelope.parse(JSON.parse(message));
response.write(formatSseFrame({ id: envelope.id, event: envelope.event, data: envelope.data }));
response.write(SSE_PING_COMMENT);
```
