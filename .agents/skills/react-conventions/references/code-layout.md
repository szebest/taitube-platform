# Code layout and names

Before calling a file done, read it top to bottom against SKILL.md rule 7 and every
section below: the file, not only the diff.

## Body order

- A small named custom hook beats an inline effect; search the feature's `hooks/` first.
- A callback that needs a derived value is passed where it is used
  (`mutate(input, { onError })`) rather than breaking the order.
- Touching a body that is out of order reorders all of it.

## Blank lines

- One around every hook call and every multi-line statement: each data hook, multi-line
  derived value, effect event, effect, handler and the return. Consecutive one-line consts
  of one kind may stay together.
- Inside effects, effect events and handlers: one after each guard, one before the final
  return or call.
- An effect event never touches the effect below it.

## Module layout

Imports, types, constants, private helpers and builders, then the exported component or
hook, one blank line between each.

## Destructuring

- **Objects, with defaults**, whenever a function reads two or more fields:
  `const { title = '', tags = [] } = video ?? {};`, not `video?.title ?? ''` line by line.
  Defaults cover only `undefined`, so a `| null` field keeps `??`.
- **Parameters** destructure in the signature: `({ items, onSelect }) => ...`.
- **Every hook result** at the call site: `const { data, isPending } = useVideo(id)`,
  never `const video = useVideo(id); video.data`.
- Clashing names are renamed after their source: `isPending: isSaving`.
- Exception: a discriminated union, which loses its narrowing when destructured.

## Functions

- **No inline functions in returned objects or descriptors**: every function is a named
  const in the handlers group. Per-item callbacks take the item's key
  (`onToggle(id, isOpen)`), or come from a named factory declared above.
- **Short bodies**: a returned literal longer than a screen becomes small named pure
  builders at module level.

## Names

Intent-revealing, in the domain's own words, saying what comes back: `currentVideo`,
`questionCount`, `isLastPage`, `uploadMutation`, not `video`, `total`, `isLast`, `upload`.

- Spec shorthand stays in the spec; test titles use the code's words.
- A key whose meaning you changed is renamed with it, locally.
- A mapper is `mapXToY`; a shared context gets a generic name and its own provider.
- Before finishing, list every function, type and local you added or renamed: would
  someone who sees only the call site know what comes back?
