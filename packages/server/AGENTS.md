# AGENTS.md — packages/server/ (Node / Bun only)

> The full tier and layer reference, including the per-package map and the recipes:
> [packages/AGENTS.md](../AGENTS.md)

---

## What belongs here

Everything a browser does not import. This is the default tier — a package is `universal` or `client`
only when it has earned it with a real consumer.

Members: `adapters`, `config`, `core`, `db`, `events`, `ffmpeg`, `job-contracts`, `observability`,
`storage`, `testing`, plus the CLI packages `compose-autoscaler`, `dev-token`, `gen-video`,
`upload-client`.

CLI packages live here rather than in `tools/` because they are workspace packages with a
`package.json`. `tools/` is for scripts and static assets that are not packages.

## Rules

1. **May depend on `universal` and `server` packages.** Never `client`.
2. **Dependencies point strictly down a layer.** `vp.layer` in `package.json` is authoritative; a
   same-layer dependency is a violation, not a judgement call. See [packages/AGENTS.md](../AGENTS.md) §2.
3. **Concrete SDKs stay in `adapters/`.** `@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres` and
   `drizzle-orm` may be imported only inside `packages/server/adapters`, `packages/server/db`, and the two
   composition roots (`apps/api/src/app.ts`, `apps/worker/src/runner.ts`). Domain logic depends on the
   abstract ports in `@vp/core/ports`.
4. **Dual runtime (Rule 2).** Worker code and shared packages must pass under both `vitest` and `bun test`.
   No `Bun.*` proprietary APIs in source.
5. **Local-first (Rule 1).** No external host, nothing phones home, `make smoke-offline` stays green.

## Before adding a package here

Ask whether the portable part is separable. `@vp/core` is 38 of 39 files portable — only
`ports/storage-client.ts` needs `Buffer` and `NodeJS.ReadableStream` — which is the kind of split worth
making when a client consumer appears for the portable half. Do not split speculatively: a universal
package with no universal consumer is an extension point without a consumer.
