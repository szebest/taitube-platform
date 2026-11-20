# AGENTS.md — @kit/config (The Environment Loader)

Instructions for any coding agent working on `@kit/config`.

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

`@kit/config` validates an environment record against a Zod schema the caller hands it and reports
every invalid key, redacted, before a process can boot half-configured. That is all it does:
`parseEnv`, `loadEnv` (`src/load-env.ts`) and `loadEnvOrExit` (`src/load-env-or-exit.ts`), plus
`describeEnvKey` (`src/env-introspection.ts`), which reads a key's input type and default from its schema.
The apps hand it `AppEnvSchema` and `host.env` (`apps/server/api/src/process.ts`,
`apps/server/worker/src/process.ts`) and pass the `AppEnv` it returns to `toAppConfig`.

The schema, the config value and its mapping are **not** here: they are the app's env schema package. Anything
that names an environment key belongs there; anything that validates a record belongs here. `zod` is a peer dependency.

---

## 2. Invariants

1. **Adding an environment key means editing the app's env schema, not this package.** The app's docs
   say what else changes with it.
2. **Fail loudly, fail early.** An invalid environment exits 1 at startup with every offending key
   listed; a key matching `password|secret|key|token|auth` — or any URL — is reported without its value.
   `parseEnv` returns that report as a `Result`, `loadEnv` throws it for an entrypoint that already has
   a logger, and `loadEnvOrExit` is for one that has none yet (the preloaded `instrument.ts` of both apps,
   `apps/server/api/src/migrate.ts`, `apps/server/api/src/seed.ts`): one JSON `fatal` line through `@kit/logger` at
   the level the caller hands it (the app passes `DEFAULT_LOG_LEVEL`), no stack, and the `ProcessHost` (`@kit/composition`) exits 1.
3. **No global read.** Every function takes the env record its caller read (`process.env` at an entrypoint, a
   literal in a spec); none reads `process.env` itself or guards on `typeof process`.

---

## 3. Local Commands

```bash
pnpm --filter @kit/config typecheck
pnpm --filter @kit/config test
```
