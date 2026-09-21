# AGENTS.md — @vp/tsconfig (TypeScript Presets)

Instructions for any coding agent working on `@vp/tsconfig`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/tsconfig` contains the shared base TypeScript configuration presets extended by all workspace packages and applications:
- `base.json`: Common strict compiler settings (ES2022 target, NodeNext module resolution, strict type checking).
- `build.json`: Settings for composite project builds generating `.d.ts` declaration maps and output bundles.

---

## 2. Invariants

- Preserve strict typing flags (`strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`).
