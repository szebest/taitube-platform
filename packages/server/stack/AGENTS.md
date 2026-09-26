# AGENTS.md — @vp/stack (server tier)

Instructions for any coding agent working on `packages/server/stack`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope

The one entrypoint that starts, stops and lists the local Compose stack: `make up [targets]`, `make down`
and `make status` call `pnpm stack`. It reads the topology from `docker compose config`, so the compose
file's `depends_on` is the only place a service's dependencies are declared, and neither this package nor
the Makefile keeps a second list.

- `src/topology.ts` parses the compose config and answers the questions: which services a target names,
  which ones are one-shots (another service waits for them to exit 0), the dependency tiers, and the
  profiles a set of services needs enabled.
- `src/containers.ts` reads `docker compose ps --format json`, decides which container failed, and prints
  the service table.
- `src/stack.ts` is `up`, `down` and `status` over a `Docker` port: build what is started, then one
  `up --wait` per tier and a `wait` for its one-shots; on a failure it names the service and prints its
  last log lines.
- `src/cli.ts` parses arguments; `src/main.ts` wires `child_process` and the process.

Targets: none is the infrastructure (every service without a profile), `all` is the infrastructure and
every app (the profiles of services built from the repo's `Dockerfile`), a profile name is its services,
`<profile>:<name>` is `<profile>-<name>` and `<profile>-<name>-*` (`worker:transcode` is the three
renditions), anything else one service by name.

- **Tier `server`**, **layer 2**: its one `@vp/*` dependency is `@vp/result` (layer 1).

---

## 2. Invariants

1. **Compose is the dependency map.** A new service declares what it needs in `depends_on` and gets a
   profile if it is not infrastructure; nothing here changes.
2. **Health, not sleeps.** A tier is done when `up --wait` sees every health check pass and every one-shot
   has exited 0.
3. **1:1 tests (Rule 12):** every source file has a name-matching test file in `src/__tests__/`.

---

## 3. Local Commands

```bash
make up web                        # infra, migrate, api and web
make status
make down
pnpm stack --help
pnpm --filter @vp/stack test
```
