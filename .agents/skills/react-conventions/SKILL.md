---
name: react-conventions
description: >-
  React and TypeScript house rules: effects and effect events, external stores, memoization,
  guards, component body order, destructuring, names, props types, modern React APIs. Use
  before writing, editing or reviewing a component, hook, effect or props type.
---

# React conventions

Written for React 19.2 or later. This repo's stack, folders and styling rules:
`references/this-repo.md`. Design and placement: `senior-engineering-practices`; specs:
`test-discipline`.

## Hard rules

1. **An effect synchronizes with something outside React**, nothing else. Work a user
   caused goes in the event handler; a value computable from props or state is derived
   during render, never synced into state; state that must reset on a new entity resets
   with `key`; data loads through the router or the query library, never a fetch in an
   effect.
2. **`useEffectEvent` for any handler an effect fires with the latest props or state.** The
   effect depends only on what it subscribes to and calls the event through an arrow with
   annotated parameters; the event is never in the deps and never passed to another
   component or hook.
3. **`useSyncExternalStore` for external state that drives rendering** (a browser API, a
   store outside React, `localStorage` read in render), with a pure snapshot that returns a
   primitive or a stable reference. Rendering a value is `useSyncExternalStore`; reacting
   to an event is an effect event in an effect.
4. **Explicit cleanup**: the unsubscribe goes in a named const, called in a returned
   cleanup; never `return subscribe(...)` straight from the effect.
5. **Memoization by contract.** With the React Compiler on, no `useMemo`, `useCallback`
   or `memo`. Without it, memoize only where referential identity is a contract: a context
   value, an effect dependency, a prop of a memoized child; anything else is noise.
6. **Braced early returns, flat guards**: every `if` body braced, exits as guards at the
   top, the happy path unindented. A positive `if` wrapping the only statement of a
   callback is the same defect: invert, return, blank line, call.
7. **Body order**, components and hooks alike, one blank line between groups: state and
   refs; router, query client, context and data hooks; derived values; side-effect hooks
   (effect events with their effects); handlers; the return. Details, blank lines and
   destructuring: `references/code-layout.md`, read before calling any touched file done.
8. **Names read at the call site**: the domain's own nouns plus `get`, `find`, `build`,
   `is`, `has`; never spec shorthand or a clever verb.
9. **Props types**: pass-through props come from React's own types
   (`React.ComponentProps<'button'>`) and are spread, never re-declared one by one.
   Mutually exclusive props are a discriminated union. Export the props type so a spec can
   build overrides from it. `interface` for shapes, `type` for unions.
10. **New code uses the current API**: `ref` as a prop over `forwardRef`, `<Context>` over
    `<Context.Provider>`, `useActionState` over pending-error-result triplets.
    Catalogue and worked effect examples: `references/modern-apis.md`.

## Styling

- One styling system per tree, the one the repo names for new code; a file you restyle
  moves to it when the repo's migration rules allow.
- Design tokens over raw values: a hex value or a palette colour where a token exists is a
  defect.
- A variants helper only when a prop selects the classes (`variant`, `size`); static
  classes go inline on the element, merged with a caller's `className` where one is
  accepted.
