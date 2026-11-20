# AGENTS.md - @kit/permissions (the CASL ability factory and the assertCan guard)

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md) · the codes it emits are spread into
> the app's set built with [@kit/errors](../errors/AGENTS.md)

## 1. Scope

A platform package (`packages/platform/`): reusable outside this product, so it holds no app vocabulary and
depends only on platform packages (`pnpm boundaries`). It is the machinery of authorization, not the rules:

- **`createAbilityFactory(ruleSets)`** (`src/ability-factory.ts`): turns the app's rule sets into a function
  from a context (the caller, a room, anything the rules read) to a CASL `MongoAbility<[A, S]>`. The action
  union `A`, the subject union `S` and the context `C` are the app's, carried as generics; a rule set is
  `RuleSet<A, S, C>`, `(context, builder) => void`.
- **`assertCan(allowed, options)`** (`src/assert-can.ts`): the throwing guard for a caller that needs an
  exception, `UNAUTHORIZED` when there is no `Actor` and `FORBIDDEN` when there is one.
- **`PermissionErrorCodes`**: the two codes `assertCan` emits. The app spreads them into its error code set.

## 2. Invariants

1. **No app rule, subject, action or role here.** They arrive as the app's rule sets and type parameters. An
   `Actor` is only an `id` and a `role` string.
2. **Rule sets apply in the order given.** CASL lets a later rule win, so an app that wants a rule set to
   override the others passes it last. Changing the order is a behaviour change for every app.
3. **A fresh ability per call.** The factory holds the rule sets and nothing else; it never caches an ability
   across contexts.
4. **`@casl/ability` is a peer.** The app installs it and owns its version; this package adds no runtime
   dependency besides `@kit/errors`.
5. **Universal.** No `node:*`, no global; it runs under `vitest`, `bun test` and in a browser.

## 3. Local Commands

```bash
pnpm --filter @kit/permissions typecheck
pnpm --filter @kit/permissions test
bun test packages/platform/universal/permissions
```
