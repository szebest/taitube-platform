# Modern React: catalogue and worked examples

Left replaces right. Confirm the installed `react` and `@types/react` versions first.

| Use | Instead of | Since |
| --- | --- | --- |
| `useEffectEvent` | a ref updated in render, `useCallback([])`, an exhaustive-deps suppression | 19.2 |
| `useSyncExternalStore` | a subscribe effect that calls `setState` | 18 |
| `use(promise or context)` | `useContext` hoisted out of a branch; promise plumbing | 19 |
| `useActionState` | `useState` triplets for pending, error and result around a submit | 19 |
| `useOptimistic` | hand-rolled optimistic state plus rollback | 19 |
| `useFormStatus` | drilling `isPending` into the submit button | 19 |
| `ref` as a plain prop | `forwardRef` | 19 |
| a cleanup returned from a ref callback | a null-check teardown inside it | 19 |
| `<Context>` | `<Context.Provider>` | 19 |
| `<title>`, `<meta>`, `<link>` rendered anywhere | a head-management library | 19 |
| `<Activity>` | mount and unmount juggling to keep a subtree warm | 19.2 |

## The tell: a dependency that is read but is not a reason to re-run

A subscription that re-arms for a reason unrelated to what it subscribes to. The worst case
is a hook that returns a fresh object every render, which re-subscribes every render.

Rejected, re-subscribes whenever `isSignedIn` or `save` changes:

```ts
useEffect(() => {
  const unsubscribe = channel.subscribe(({ key, value }: Change) => {
    if (!isSignedIn) {
      writeLocally(value);
    }

    save({ key, value });
  });

  return () => {
    unsubscribe();
  };
}, [isSignedIn, save]);
```

Used, subscribes once and the handler always reads fresh values:

```ts
const applyChange = useEffectEvent(({ key, value }: Change) => {
  if (!isSignedIn) {
    writeLocally(value);
  }

  save({ key, value });
});

useEffect(() => {
  const unsubscribe = channel.subscribe((change: Change) => {
    applyChange(change);
  });

  return () => {
    unsubscribe();
  };
}, []);
```

A one-shot call inside an otherwise reactive effect: move only the non-reactive call into
an effect event, and the deps become honest.

```ts
const restoreStored = useEffectEvent((stored: Theme) => {
  setTheme(stored);
});

useEffect(() => {
  if (isSignedIn) {
    persistTheme(theme);
    return;
  }

  const stored = readStoredTheme();

  if (stored && stored !== theme) {
    restoreStored(stored);
  }
}, [isSignedIn, theme]);
```

## useSyncExternalStore for a browser value read in render

```ts
const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange);

  return () => {
    window.removeEventListener('storage', onChange);
  };
};

const draft = useSyncExternalStore(subscribeToStorage, readDraft, () => null);
```

The snapshot returns a primitive, so its identity is stable; the third argument is the
server snapshot when the tree renders on a server.

## Props shapes

```ts
export interface BadgeProps extends React.ComponentProps<'span'> {
  label: string;
}
```

Mutually exclusive props are the discriminated union in `senior-engineering-practices`,
`references/patterns.md`, Extend, do not fork. Destructuring a discriminated union loses
the narrowing: narrow first, or pass the object through unchanged, never `as`.
`Partial<T>` over a union collapses the discriminant: export the base and the union
separately so a spec composes `Partial<Base> & <Union>`.

## With the React Compiler on

- **Silent memo loss**: a `= []` default parameter ahead of later hooks (use a module
  constant); a value built before a hook and used after it (build it after the hooks).
- **A whole function skipped**: a react-hooks lint suppression inside it (delete the
  suppression), or a `use`-named function that calls no hook (rename it to a plain
  `build...` function).
- **A compile error**: a hook placed above a handler it uses, even through an arrow.
- Check the compiled output of one file, never assume: work outside the `if ($[n] !== ...)`
  cache blocks is redone every render.
