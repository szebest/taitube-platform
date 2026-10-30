# ResponsiveModal

One modal that is a [dialog](dialog.md) from 600 px and a [drawer](drawer.md) below, so a feature registers a modal once and never picks its container.

## Anatomy

| Part | Dialog (medium and up) | Drawer (compact) |
|---|---|---|
| `ResponsiveModal.Root` | `Dialog.Root` | `Drawer.Root` |
| `ResponsiveModal.Content` | `Dialog.Content` with its close button | `Drawer.Content` with `Drawer.Handle` |
| `Title`, `Description`, `Body`, `Footer` | the dialog parts | the drawer parts |
| `Close` | `Dialog.Close` | `Dialog.Close` |

## API

```ts
// Root takes the Radix dialog root props: open, defaultOpen, onOpenChange, modal.
interface ResponsiveModalContentProps {
  size?: ResponsiveModalSize; // 'sm' | 'md' | 'lg', the sizes both containers share
}
```

The container follows `COMPACT_QUERY` (`(max-width: 599px)`) through `useMediaQuery`. A portal has no container on the server, so until hydration `Content` renders in place (`inline` on `Dialog.Content` and `Drawer.Content`) and the server draws the dialog; a compact client swaps to the drawer on hydration. Crossing the breakpoint swaps the container and keeps the modal open, since its open state belongs to the caller. In the apps it is bound to the URL by `features/url-modal`.

```tsx
<ResponsiveModal.Root open={isOpen} onOpenChange={(open) => !open && close()}>
  <ResponsiveModal.Content>
    <ResponsiveModal.Title>Share video</ResponsiveModal.Title>
    <ResponsiveModal.Body>...</ResponsiveModal.Body>
  </ResponsiveModal.Content>
</ResponsiveModal.Root>
```
