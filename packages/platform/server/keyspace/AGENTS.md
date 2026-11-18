# AGENTS.md — @kit/keyspace (SSE Message Envelope & Frames)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

`SseMessageEnvelope` (Zod) is the JSON a publisher puts on a channel and a subscriber parses; `formatSseFrame`
turns an id, event and data into one `text/event-stream` frame; `SSE_PING_COMMENT` is the keep-alive comment.
Consumers: the API's SSE hub and connections, and `publishVideoEvent` in `@vp/events`.

---

## 2. Invariants

1. **Layer 1, no `@vp/*` dependency.** `zod` is a peer dependency; the host lists it.
2. **No channel or key names here.** Those are the app's, in `@vp/events`.

---

## 3. Local Commands

```bash
pnpm --filter @kit/keyspace typecheck
pnpm --filter @kit/keyspace test
```
