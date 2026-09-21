# AGENTS.md — @vp/tsconfig (TypeScript Presets)

Instructions for any coding agent working on `@vp/tsconfig`.

> Tiers, layers and the import rules in full: [docs/standards/package-boundaries.md](../../../docs/standards/package-boundaries.md)
---

## 1. Scope & Purpose

`@vp/tsconfig` contains the shared base TypeScript configuration presets extended by all workspace packages and applications:
- `base.json`: Common strict compiler settings (ES2022 target, NodeNext module resolution, strict type checking).
- `build.json`: Settings for composite project builds generating `.d.ts` declaration maps and output bundles.

---

## 2. Invariants

- Preserve strict typing flags (`strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`).
