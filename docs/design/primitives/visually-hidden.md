# VisuallyHidden

Text that is invisible on screen but present for screen readers and search, for names a design leaves out.

## Anatomy

```
   [ icon ] (1) "Notifications"   <- off-screen text, read aloud
```

| # | Part | Notes |
|---|---|---|
| 1 | Hidden text | Clipped to 1 px and positioned off the layout, not `display: none`. |

## API

```ts
interface VisuallyHiddenProps extends ComponentPropsWithRef<typeof VisuallyHidden.Root> {} // Radix; asChild supported
```

No own props. Use it for the accessible name of an icon that cannot take `aria-label`, a dialog title the design omits, a status message, or a "required" suffix.

```tsx
<Dialog.Title asChild><VisuallyHidden>Search</VisuallyHidden></Dialog.Title>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| Default | none | Always. It has no look, no sizes and no variants. |

## States

| State | What changes |
|---|---|
| Rest | Hidden visually, exposed to assistive technology. |
| Focus | If the hidden element is focusable it must not use this; use a skip-link that becomes visible on focus. |
| Hover, pressed, disabled, loading, invalid | Not applicable. |

## Tokens

None: no role, radius, type or motion. It must not set a colour or size that could leak into layout.

## Accessibility

- Radix VisuallyHidden uses the clip-rect pattern, so the text is in the accessibility tree and selectable by screen readers' virtual cursor.
- Not `display: none`, `visibility: hidden` or `aria-hidden`, which would remove it.
- The caller's text is ordinary children, translated by the app like visible copy; only strings the primitives add themselves come from [ui-copy-provider](ui-copy-provider.md).
- Prefer a visible label where space allows; hidden text is for names the design cannot show.

## Do and don't

- Do give every dialog a title, hidden if the design has none.
- Do keep the text short and meaningful on its own.
- Do translate it through the catalogue.
- Don't hide interactive content with it.
- Don't use it to stuff keywords.
- Don't use it where an `aria-label` on the control is simpler.

## In the workbench

Stories: an icon button named by hidden text, a dialog title, a status message announcing a result, a required suffix on a label, with a screen-reader outline toggle that reveals the text in the story. Axes: themes by modes and RTL (no visual change expected).
