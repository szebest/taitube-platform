# AGENTS.md — @vp/config (The Environment Loader)

Instructions for any coding agent working on `@vp/config`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/config` reads `process.env`, validates it against `@vp/env-schema`, prints a redacted report of
every invalid key and exits 1 before a process can boot half-configured. That is all it does.

The schema itself is **not** here. It is `@vp/env-schema`, one layer down. Anything that names an
environment key belongs there; anything that touches a runtime belongs here.

It also ships the Node module-resolution hook the apps load with `node --import @vp/config/register`,
which resolves extensionless relative specifiers in compiled output.

---

## 2. Invariants

1. **Adding an environment key means editing `@vp/env-schema`, not this package.** Add it there, to
   `.env.example`, and to `docs/SDD.md` §16 (Rule 3).
2. **Fail loudly, fail early.** An invalid environment exits 1 at startup with every offending key
   listed; a key matching `password|secret|key|token|auth` — or any URL — is reported without its value.
   `parseEnv` returns that report as a `Result`, `loadEnv` throws it for an entrypoint that already has
   a logger, and `loadEnvOrExit` is for one that has none yet (the preloaded `instrument.ts`, migrate,
   seed): one JSON `fatal` line at the default level, no stack, and the host exits 1.
3. **No `typeof process` guard.** Server tier means `process` is there. A feature-detect standing in for
   a boundary is what this split removed; do not reintroduce one.

---

## 3. Local Commands

```bash
pnpm --filter @vp/config typecheck
pnpm --filter @vp/config test
```
