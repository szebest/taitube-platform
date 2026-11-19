# AGENTS.md — @kit/keyspace (SSE Frames)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

`formatSseFrame` turns an id, an event name and data into one `text/event-stream` frame; `SSE_PING_COMMENT` is
the keep-alive comment. Consumers: the API's SSE connections.

---

## 2. Invariants

1. **Layer 1, no `@vp/*` dependency.** No runtime dependency.
2. **No channel, key or event names here.** Those are the app's, in `@vp/events`, with the message envelope.

---

## 3. Local Commands

```bash
pnpm --filter @kit/keyspace typecheck
pnpm --filter @kit/keyspace test
```
