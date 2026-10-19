# UiCopyProvider

The one place a primitive gets the words it prints itself, so `@vp/ui` stays free of the message catalogue.

## Anatomy

```
   app root
   +-- (1) UiCopyProvider copy={...from @vp/messages}
        +-- (2) Dialog.Content  -> close button label
        +-- (2) Field.Label     -> required mark text
        +-- (2) Command.Empty   -> "no results" line
```

| # | Part | Notes |
|---|---|---|
| 1 | `UiCopyProvider` | Mounted once at each app's root, beside the theme and toast providers. |
| 2 | Consumers | Primitives that print a string call `useUiCopy()`; none takes a label prop for it. |

## API

```ts
interface UiCopy {
  close: string;       // Dialog, Drawer, Toast close buttons
  required: string;    // Field.Label required mark, read by screen readers
  optional: string;    // Field.Label optional hint
  noResults: string;   // Command.Empty
  loading: string;     // Command.Loading, a Spinner with no children
  clear: string;       // a cleared search Input adornment
  // further keys are added here as a primitive needs one, never as a prop
}
interface UiCopyProviderProps { copy: UiCopy; children: ReactNode }
function useUiCopy(): UiCopy;   // throws outside a provider
```

`UiCopy` is a type declared in `@vp/ui`; each app builds the value from its `@vp/messages` catalogue, so translation, plurals and locale live where they already do. The provider is the only component in the package that is not visual. Today the strings are props (`closeLabel` on `DialogContent` and `ToastProvider`); the target removes them.

```tsx
<UiCopyProvider copy={{ close: t('ui.close'), required: t('ui.required'), optional: t('ui.optional'), noResults: t('ui.noResults'), loading: t('ui.loading'), clear: t('ui.clear') }}>
  <App />
</UiCopyProvider>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| none | none | It has no look, no variants and no sizes; it renders its children only. |

## States

| State | What changes |
|---|---|
| Mounted | Consumers read the strings. |
| Locale change | The app passes a new `copy`; consumers re-render with the new words, with no remount. |
| Missing provider | `useUiCopy()` throws in development and in the workbench, so a missing mount fails a story and a spec, not a user. |

Hover, focus, pressed, disabled, loading and invalid do not apply.

## Tokens

None: no role, radius, type style or motion. It styles nothing.

## Accessibility

- Every string it holds is accessible text or a visible built-in label, so a complete, translated catalogue is an accessibility requirement: a missing key must fail the type check, not fall back to English.
- Strings are plain text with no markup and no interpolation; anything with a count belongs to the caller.
- The `lang` of the document drives the values; the provider does not set it.
- Text a caller supplies (titles, `aria-label`, hidden text) never goes through it.

## Do and don't

- Do mount it once per app, at the root, filled from the catalogue.
- Do add a key to `UiCopy` when a primitive must print a new string, in the same change.
- Do wrap the workbench and every spec with a provider of fixture strings.
- Don't add a label prop to a primitive for a string the provider can hold.
- Don't put product copy here; it holds control chrome only.
- Don't import `@vp/messages` from `@vp/ui`.

## In the workbench

Stories: a Dialog, a Field with required and optional labels, a Command with no results, a Toast, all inside the provider; the same stories under a pseudo-locale and an RTL locale with long strings; a story that mounts a primitive without the provider and shows the thrown error. Axes: themes by modes and RTL (long strings must not clip).
