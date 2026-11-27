# AGENTS.md — @kit/keyspace (key namespaces and SSE frames)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

`defineKeyspace(namespace, (key) => layout)` (`src/keyspace.ts`) is how an app lays out its cache keys: the
layout builds every key through `key(...parts)`, a `KeyNamespace` that joins the parts with `:` after the
namespace and types the result `` `${namespace}:${string}` ``, and comes back frozen. A second app builds its own
layout under its own namespace; this package names none.

`formatSseFrame` (`src/sse.ts`) turns an id, an event name and data into one `text/event-stream` frame;
`SSE_PING_COMMENT` is the keep-alive comment.

---

## 2. Invariants

1. **Layer 1, no workspace dependency.** No runtime dependency.
2. **No namespace, key, channel or event name here.** Those are the app's: its key layout, its channels and its
   message envelope.

---

## 3. Local Commands

```bash
pnpm --filter @kit/keyspace typecheck
pnpm --filter @kit/keyspace test
```
