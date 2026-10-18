# Toast

A transient message about something that already happened, shown over the page without taking focus.

## Anatomy

```
   +--------------------------------------------+
   | (1) icon  (2) Title                  (5) x |
   |           (3) Description                  |
   |                         (4) [Undo]         |
   +--------------------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Toast.Icon` | Required for `success`, `warning`, `danger`, `info`; tone is never colour alone. |
| 2 | `Toast.Title` | `label` style, one line. |
| 3 | `Toast.Description` | `body-sm` in `fg-muted`, optional. |
| 4 | `Toast.Action` | One follow-up, a small [button](button.md). |
| 5 | `Toast.Close` | Built-in [icon-button](icon-button.md); its label is `close` from `useUiCopy()`. |

## API

```ts
// types.ts
import type { ToneOption } from '@vp/design-tokens';

export type ToastTone = Exclude<ToneOption, 'accent' | 'live'>;
```

```ts
interface ToastRootProps extends ComponentPropsWithRef<typeof Toast.Root> { // Radix Toast: open, onOpenChange, duration
  tone?: ToastTone;                                                          // default 'neutral'
}
// Parts: Toast.Root, .Icon, .Title, .Description, .Action (altText), .Close
// App level: ToastProvider ({ toaster }), useToast() -> show, createToaster() for code outside React
```

`show({ tone, title, description, action })` builds the parts for the common case; compose the parts directly only for a custom toast. Today's `variant` of `neutral | success | danger` becomes `tone`, adding `warning` and `info`. The provider, `useToast`, `createToaster` and the queue-before-mount behaviour stay; `closeLabel` stops being a prop on the provider; the label is `close` from [ui-copy-provider](ui-copy-provider.md).

```tsx
<Toast.Root tone="danger">
  <Toast.Icon><AlertCircle /></Toast.Icon>
  <Toast.Title>Could not save</Toast.Title>
  <Toast.Description>Check your connection.</Toast.Description>
  <Toast.Action altText="Retry saving" asChild><Button size="sm">Retry</Button></Toast.Action>
</Toast.Root>
```

## Variants and sizes

| Tone | Roles | When to use |
|---|---|---|
| `neutral` | `raised`, `border`, `fg` | Plain confirmation ("Saved to Watch later"). |
| `success` | `success-ink` icon | A completed operation. |
| `warning` | `warning-ink` icon (coral in Nocturne) | Something needs attention but worked. |
| `danger` | `danger-ink` icon | A failure, with a retry action when one exists. |
| `info` | `info-ink` icon | A neutral notice. |

Ground is always `raised` with a `border` outline and elevation 3; the tone shows in the icon and the leading edge accent. Radius `card`. Padding `spacing.inset-control`, gap `gap-inline`. No size axis.

## States

| State | What changes |
|---|---|
| Entering | Slides in from the inline end, `motion.duration.base` with `enter`. |
| Resting | Visible for 5 s (8 s with an action); paused on hover and focus. |
| Hover and focus | Timer pauses; `focus-ring` on the focused control. |
| Swiping | Follows the pointer 1:1; dismisses past a threshold. |
| Leaving | Fades, `fast` with `exit`. |
| Reduced motion | Fade only. |

## Tokens

- Colour roles `raised`, `border`, `fg`, `fg-muted`, `success-ink`, `warning-ink`, `danger-ink`, `info-ink`.
- `spacing`: `inset-control`, `gap-inline`, `gutter-compact` (viewport margin). `sizing`: `icon.md`. `radius`: `card`. `border`: `divider`. `shadow`: elevation 3.
- Type `label`, `body-sm`. `motion`: `base`, `fast`, easings `enter`, `exit`. z `toast`.

## Accessibility

- Radix Toast: a live region (`role="status"`, polite; `danger` uses assertive), with a viewport reachable by the F8 hotkey.
- A toast must not hold the only copy of a result or the only route to an action; `Toast.Action` needs `altText` for keyboard users who miss the timeout.
- Pausing on hover and focus satisfies the timing guideline; Escape dismisses the focused toast.
- Do not move focus to a toast.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Toast.Action` and `Toast.Close`.
- `useToastItem()` returns `{ tone }` for a toast's parts (distinct from the app-level `useToast()` that shows toasts), so a part written in an app can read it.
- `toastStyles`, the `tv()` definition, is exported: `tv({ extend: toastStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do keep the title to a few words and put detail in the description.
- Do offer one action at most.
- Do use `danger` with a retry for recoverable failures.
- Don't toast something the viewer is watching happen (a field error belongs to the [field](field.md)).
- Don't stack more than three; the oldest leaves.
- Don't use a toast for a decision; use a [dialog](dialog.md).

## In the workbench

Stories: one per tone (5: `neutral`, `success`, `warning`, `danger`, `info`), with action, with long text, stacked three, swipe, timer pause, from `createToaster` before the provider mounts. Axes: themes by modes (Nocturne warning is coral with its icon), RTL (enters from the start edge), reduced motion, more contrast, 320 px width.
