# AGENTS.md - @kit/runtime (environment tokens)

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md) · tokens and registry:
> [@kit/di](../di/AGENTS.md)

## 1. Scope

A platform package (`packages/platform/`): no app vocabulary, platform dependencies only. It declares the tokens a
runtime-agnostic package asks for instead of reading the environment itself (`src/tokens.ts`): `Clock`, `Random`,
`EnvSource`, `Fetch`, `CookieJar`. Two subpath entries provide them for a registry:

| Entry | Provides | Takes |
|---|---|---|
| `@kit/runtime/node` (Node and Bun) | `Clock`, `Random`, `EnvSource`, `Fetch` | the env record the deployable's `main.ts` read |
| `@kit/runtime/browser` | the same four and `CookieJar` | the env record and the page's `cookieStore` |

On a server the cookies belong to a request, so the node entry provides no `CookieJar`; the app provides one per
request.

Install: `pnpm add @kit/runtime`. Tokens: it declares the five above and consumes none. Registries: none; an entry
returns providers for the app's registry. Usage: see [README.md](README.md).

## 2. Invariants

1. **The entries take what they read.** No file here reads `process.env`, `document` or `cookieStore`; the caller
   hands them in, which keeps `process.env` read once at `apps/*/*/src/main.ts` (CLAUDE.md rule 3).
2. **Universal, T3** (above `@kit/di`), ESM only, `sideEffects: false`; runs under `vitest` and `bun test`. No
   `node:*` import, no `Bun.*`.
3. **One shared set.** Node, Bun and a browser share the four standard providers (`src/environment.ts`); an entry
   adds only what its environment alone has.

## 3. Local Commands

```bash
pnpm --filter @kit/runtime typecheck
pnpm --filter @kit/runtime test
bun test packages/platform/universal/runtime
```
