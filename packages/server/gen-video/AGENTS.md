# AGENTS.md — @vp/gen-video (server tier)

Instructions for any coding agent working on `packages/server/gen-video`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

Synthetic video fixture generator (FFmpeg `testsrc2` and `sine`). `manifest.json` lists the fixtures;
`pnpm gen-video` writes them to the untracked fixtures folder under tests/ (`--output-dir` moves it;
fast set by default, `--include-slow` for the long ones, `--only <id>` for one), and `--check` probes
each file against its manifest metadata. Encoders differ across platforms, so the check compares stream
metadata, not bytes. See [README.md](README.md).

This is a **workspace package with a CLI**, not a loose script, which is why it lives under
`packages/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`**, **`vp.layer` 2** - it logs through `@vp/logger` (layer 1), its only dependency.
- `src/main.ts` is the entrypoint: it builds a `pretty` logger and hands it to `run` in `src/cli.ts`.
  Help text goes to stdout; progress and failures go to the logger on stderr.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **Dual runtime (Rule 2):** the root `pnpm gen-video` script runs it through `tsx`, and it must still run cleanly under `bun`, which `pnpm test:bun` proves.
3. **1:1 tests (Rule 12):** every source file has a name-matching test file, except `src/generator.ts`,
   which is on the shrink-only list in `tests/architecture/untested-sources.ts`.

---

## 3. Local Commands

```bash
pnpm gen-video            # from the repo root
pnpm --filter @vp/gen-video typecheck
pnpm --filter @vp/gen-video test
```
