# SectionError

The partial state: one section failed inside a page that did not. The comments call can fail while the video keeps playing; a shelf can fail while Home stays usable. In `@vp/components` because web shelves and the discussion and studio tables and charts all render it.

## Anatomy

```
 ┌────────────────────────────────────────────────────────────┐
 │ (!) 1 Comments did not load.                               │
 │     2 The rest of the page is fine.   [ 3 Try again ]      │
 └────────────────────────────────────────────────────────────┘
```

| # | Region | Notes |
|---|---|---|
| 1 | Message | `label`, names the section that failed |
| 2 | Support line | `body-sm`, `fg-muted`, optional |
| 3 | Retry | `Button` `outline` fill at `sm` size; reloads only this section |

## Props

Plus the standard props. The message is the child.

```ts
// types.ts
import type { ToneOption } from '@vp/design-tokens';

export type SectionErrorLayout = 'bar' | 'block';
export type SectionErrorTone = Extract<ToneOption, 'danger' | 'warning'>;
```

```ts
interface SectionErrorRootProps {
  layout?: SectionErrorLayout; // default 'bar'
  tone?: SectionErrorTone;     // default 'danger'; 'warning' for partial data
  onRetry: () => void;
}
// Parts: SectionError.Root, .Message, .Support, .Reference
```

```tsx
<SectionError.Root layout="bar" onRetry={refetch} style={{ minHeight: 320 }}>
  <SectionError.Message>Comments did not load.</SectionError.Message>
  <SectionError.Support>The rest of the page is fine.</SectionError.Support>
</SectionError.Root>
```

The reserved height is the caller's `style` or `className` (the loaded section's height), so nothing below shifts. The retry label and spinner come from `useUiCopy()`; a reference id is an optional `<SectionError.Reference />` child.

## Extension points

| Need | Point |
|---|---|
| Reserved height, a one-off tweak | `className` or `style` on the root |
| A different retry control | compose your own element inside the root and call `useSectionError().retry`, the exported context hook |
| An app-local look | `tv({ extend: sectionErrorStyles, variants: { ... } })` |

## Variants

| `layout` | Layout |
|---|---|
| `bar` | one row, `control.lg` high plus `inset-control` padding, `danger-ink` icon, for a compact section like a shelf track or a comment list |
| `block` | centred in a reserved area, icon above the message, for charts and tables |

## States

| State | What changes |
|---|---|
| default | as drawn; `surface` ground, `border` role at the divider width, radius `card` |
| retrying | retry shows a `Spinner` |
| retry failed | the support line changes, focus stays on retry |
| warning | `tone="warning"` uses `warning-ink` and its icon, for partial data (some rows loaded) |
| succeeded | the app removes it; the content takes its place at the same height |
| skeleton | the section's own skeleton shows during retry; the error returns only if it fails again |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | the retry drops under the message, full width |
| medium | one row |
| expanded | one row |
| large | one row; `block` max width at the reading measure |

## Motion

- Appears with opacity at `base`; no slide, so it does not move content.
- Reduced motion: same.

## Accessibility

- `role="alert"` is used once when it replaces content that was already visible or expected; the message names the section so the announcement is meaningful on its own.
- The retry button is the first focusable element inside, and focus moves to the section's heading, not to the error, when the retry succeeds.
- Colour is paired with an icon and words.
- It never traps focus and never blocks the rest of the page.

## Composition

`Callout` (the ground and icon), `Button`, `Spinner`, `Icon`.

## Used by

- Web: [59, watch page](../../tickets/59-video-watch-page-responsive-layout-enhancements.md) (the discussion's own error boundary); shelves in [58](../../tickets/58-modern-browse-layout-microinteractions-motion.md); [70, resilient error handling](../../tickets/70-frontend-resilient-error-handling-retry-policy.md) (the section error boundary)
- Studio: tables and charts in [60](../../tickets/60-creator-studio-dashboard-video-management-ui.md)

## Workbench stories

- Bar in place of a shelf
- Block in place of a chart
- Warning with partial data
- Retrying
- Retry failed
- With reference
- Compact
- RTL
