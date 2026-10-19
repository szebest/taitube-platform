# Dialog

A modal surface that interrupts the page for a decision or a short task; it also provides the Sheet, the same dialog docked to an edge.

## Anatomy

```
   ::::::::::::::::::: (1) overlay (scrim) :::::::::::::::::::
   :    +---------------------------------------+    :
   :    | (2) Title                        (3) X |    :
   :    | (4) Description                        |    :
   :    | (5) Body                               |    :
   :    |              (6) Footer: [Cancel] [OK] |    :
   :    +---------------------------------------+    :
```

| # | Part | Notes |
|---|---|---|
| 1 | `Dialog.Overlay` | `scrim`, fades in with `motion.duration.slow`. |
| 2 | `Dialog.Title` | `title-lg`. Required. |
| 3 | `Dialog.Close` | An [icon-button](icon-button.md) in the corner, labelled with `close` from [ui-copy-provider](ui-copy-provider.md). |
| 4 | `Dialog.Description` | `body-sm` in `fg-muted`. Optional but recommended. |
| 5 | `Dialog.Body` | Scrolls inside the surface; the page behind is locked. |
| 6 | `Dialog.Footer` | Actions at the end; primary last in LTR. |

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';
import type { Side } from '../../types';

export type DialogSide = Extract<Side, 'inline-start' | 'inline-end'>;
export type DialogSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
```

```ts
interface DialogContentProps extends ComponentPropsWithRef<typeof Dialog.Content> { // Radix Dialog
  side?: DialogSide;   // omitted: a centred dialog; set: the Sheet docked to that edge
  size?: DialogSize;   // max width of a centred dialog or a sheet; default 'md'
}
// Parts: Dialog.Root, .Trigger, .Content, .Header, .Title, .Description, .Body, .Footer, .Close
// Confirmations: AlertDialog.Root, .Trigger, .Content, .Title, .Description, .Cancel, .Action
```

`side` is logical, so a sheet docks to the start or end edge in either direction; the bottom edge is [drawer](drawer.md), not a `side` here. Widths for `size` are component measures (no sizing token covers a surface width). `Dialog.Content` renders the portal, the overlay and the corner close button; the close button's label is `close` from `useUiCopy()`, not a prop. The title is `<Dialog.Title>`, never a `title` prop; hide it with [visually-hidden](visually-hidden.md) when the design has none. Today these are flat exports (`DialogContent`, `ModalContent`) with a required `closeLabel`, plus a separate `Sheet`; the target folds `Sheet` into `side` and moves confirmation to `AlertDialog`.

```tsx
<Dialog.Root>
  <Dialog.Trigger asChild><Button>Rename</Button></Dialog.Trigger>
  <Dialog.Content size="sm">
    <Dialog.Header>
      <Dialog.Title>Rename video</Dialog.Title>
      <Dialog.Description>Shown on the watch page.</Dialog.Description>
    </Dialog.Header>
    <Dialog.Body><Input defaultValue={video.title} /></Dialog.Body>
    <Dialog.Footer>
      <Dialog.Close asChild><Button>Cancel</Button></Dialog.Close>
      <Button variant="solid" tone="accent">Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

## Variants and sizes

| Form | Roles | When to use |
|---|---|---|
| centred (no `side`) | `raised`, `border`, elevation 3, radius `sheet` | Centred task or confirmation. |
| `side="inline-start"` or `"inline-end"` | `raised`, `border`, radius `sheet` on the inner corners | Secondary tasks, the queue, filters, side navigation on medium and up. |
| `AlertDialog` | same as centred, plus a `danger-ink` title icon when destructive | A decision that cannot be dismissed by outside click. |

On compact, a bottom sheet is the job of [drawer](drawer.md). Surface padding is `spacing.inset-card`, gap between regions `gap-stack`.

## States

| State | What changes |
|---|---|
| Open | Overlay fades over `motion.duration.slow` with `enter`; surface scales from 0.96 and fades, `slow`. Sheet slides from its edge. |
| Closed | `exit` easing, `motion.duration.base`. |
| Focus-visible | Ring on the focused control inside. |
| Loading | A footer `Button` shows `loading`; the dialog does not close itself. |
| Keyboard open | Opened by shortcut: no animation. |
| Reduced motion | Opacity only. |

## Tokens

- Colour roles `raised`, `border`, `scrim`, `fg`, `fg-muted`, `danger-ink`.
- `spacing`: `inset-card`, `gap-stack`, `gap-inline` in the footer. `radius`: `sheet`. `border`: `divider`. `shadow`: elevation 3.
- Type `title-lg`, `body-sm`. `motion`: `slow`, `base`, easings `enter`, `exit`. z `overlay`, `modal`.

## Accessibility

- Radix Dialog gives `role="dialog"` (`alertdialog` for `AlertDialog`), `aria-modal`, `aria-labelledby` from the title and `aria-describedby` from the description.
- Focus moves into the dialog on open, is trapped, and returns to the trigger on close. Escape closes; `AlertDialog` ignores outside pointer events.
- Every dialog needs a `Dialog.Title`; hide it with [visually-hidden](visually-hidden.md) when the design has none.
- The page behind is inert and scroll is locked.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Trigger`, `Close`, `Title` and `Description`.
- `useDialog()` returns `{ side, size, open }`, so a part written in an app can read it.
- `dialogStyles`, the `tv()` definition, is exported: `tv({ extend: dialogStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do give the primary action the last position in the footer.
- Do keep the body short; a long task becomes a page.
- Do use `AlertDialog` for destructive confirmation with a `danger` button.
- Don't open a dialog from a dialog; replace the content.
- Don't dismiss unsaved input on outside click; intercept `onInteractOutside`.
- Don't use a dialog for a status message; use a [toast](toast.md) or [callout](callout.md).

## In the workbench

Stories: dialog sizes (3), alert destructive, sheet at each side (`inline-start`, `inline-end`), long scrolling body, with form and error, without description, opening and closing motion, keyboard open (no motion), nested menu inside. Axes: themes by modes (Nocturne is sharper), RTL (the inline sides flip), compact density, reduced motion, 320 px width.
