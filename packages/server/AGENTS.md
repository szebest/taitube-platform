# AGENTS.md — packages/server/ (Node / Bun only)

> The full tier and layer reference, including the per-package map and the recipes:
> [packages/AGENTS.md](../AGENTS.md)

---

## What belongs here

Everything a browser does not import. This is the default tier — a package is `universal` or `client`
only when it has earned it with a real consumer.

Members (app packages, `@vp/*`): `adapters`, `core`, `db`, `env-schema`, `events`, `ffmpeg`, `fingerprint`,
`job-contracts`, `pipeline-metrics`, `storage`, `testing-fixtures`, `whisper`, plus `demo`, `deploy`, `dev-identity`, `stack` and the CLI packages `gen-video`,
`lighthouse` and `upload-client`. The platform packages (`@kit/*`) sit in `packages/platform/server/`: `compose-autoscaler`,
`composition`, `concurrency`, `config`, `dev-token`, `keyspace`, `logger`, `object-storage`, `observability`, `testing`,
`vite-preset` (the client apps' Vite config, build tooling).

**Platform or app, first.** A server package that names no product value belongs in `packages/platform/server/`, and
it never depends on, imports or names a `@vp/*` package. What the app owns (its env schema, key namespace, metric
prefix, dev-token issuer, log level) is a required, typed parameter the app passes from its composition root:
`@kit/config` takes the schema, `@kit/keyspace` takes the namespace, `@kit/observability` takes the metric config. See
[docs/standards/platform-packages.md](../../docs/standards/platform-packages.md).

CLI packages live here rather than in `tools/` because they are workspace packages with a
`package.json`. `tools/` is for scripts and static assets that are not packages.

## Rules

1. **May depend on `universal` and `server` packages.** Never `client`.
2. **Dependencies point strictly down a layer.** `vp.layer` in `package.json` is authoritative; a
   same-layer dependency is a violation, not a judgement call. See [packages/AGENTS.md](../AGENTS.md) §2.
3. **Concrete SDKs stay in `adapters/`.** `@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres` and
   `drizzle-orm` may be imported only inside `packages/server/adapters` and `packages/server/db`. The two
   composition roots (`apps/server/api/src/app.ts`, `apps/server/worker/src/runner.ts`) name no SDK: they call
   `registerAdapters` from `@vp/adapters`. Domain logic depends on the abstract ports in `@vp/core/ports`.
4. **Dual runtime (Rule 2).** Worker code and shared packages must pass under both `vitest` and `bun test`.
   No `Bun.*` proprietary APIs in source.
5. **Local-first (Rule 1).** No external host, nothing phones home, `make smoke-offline` stays green.

## Before adding a package here

Ask whether the portable part is separable, and whether anything client-side would import it. `@vp/core`
was 38 of 39 files portable — only `ports/storage-client.ts` needs `Buffer` and `NodeJS.ReadableStream` —
so the entities and policy left as `@vp/domain` and the keyset cursors left as `@kit/pagination`, both
`universal`, and each deleted a copy `@vp/api-contracts` had been keeping.

Two packages were looked at and deliberately kept whole:

- **`adapters`.** Few of its source files name a Node builtin, but the tier is not decided by builtins here:
  every subfolder wraps a concrete server SDK, and even the in-memory doubles implement `Buffer`-typed
  ports. Splitting it would produce fragments with one consumer each.
- **`ffmpeg`.** `ladder.ts` and `master.ts` are portable, but nothing on the client renders a quality
  selector, so the split would create a universal package with no universal consumer and collapse no
  existing duplication. Revisit when a client first needs the ladder.

Do not split speculatively: a universal package with no universal consumer is an extension point without
a consumer. The splits above each collapsed a duplication that existed at the time.
