# AGENTS.md — @vp/events (Event Schemas & Redis Pub/Sub Dispatcher)

Instructions for any coding agent working on `@vp/events`.

---

## 1. Scope & Purpose

`@vp/events` defines the Zod schemas and TypeScript types for real-time video lifecycle events, Server-Sent Events (SSE), and Redis Pub/Sub messages.
- Event channels: `video:{id}` and `user:{id}`.
- Event types: `snapshot`, `progress`, `status`.

---

## 2. Invariants

- All event payloads emitted over Redis Pub/Sub or SSE must validate against Zod schemas in this package.
- Progress updates are throttled and formatted with integer percentages, current rendition, and ETA.

---

## 3. Local Commands

```bash
pnpm --filter @vp/events typecheck
pnpm --filter @vp/events test
```
