# AGENTS.md — @vp/events (Event Schemas & Redis Pub/Sub Dispatcher)

Instructions for any coding agent working on `@vp/events`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/events` owns the Redis vocabulary the API, the worker and the adapters share. Tier `server`,
`vp.layer` 2; depends on `@vp/errors`, `@vp/result` and `zod`.

- `src/index.ts` - `SseMessageEnvelope` (Zod: `event` is `snapshot`, `progress` or `status`),
  `publishVideoEvent`, `formatSseFrame` and `SSE_PING_COMMENT`.
- `src/channels.ts` - Pub/Sub channels `video:{id}` and `user:{id}`: `videoChannel`, `userChannel`,
  `VIDEO_WILDCARD_CHANNEL`, `USER_WILDCARD_CHANNEL`, `channelType`.
- `src/keys.ts` - `CacheKeys`, every `taitube:` cache key.

---

## 2. Invariants

- A Redis key or channel is built only in `keys.ts` or `channels.ts`; a template literal starting
  `taitube:`, `video:` or `user:` anywhere else fails `tests/architecture/redis-keys-owner.test.ts`.
- `publishVideoEvent` publishes to the video's channel and, when a `userId` is given, the owner's. It
  returns a `Result`; the caller decides what a refused publish means.
- The API's SSE hub parses every message it receives with `SseMessageEnvelope` before it forwards it.

---

## 3. Local Commands

```bash
pnpm --filter @vp/events typecheck
pnpm --filter @vp/events test
```
