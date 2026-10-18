# NotificationCentre

Location: `apps/client/web/src/components/shell/notification-centre/`. Web's app kit, presentational and compound, built from `Popover`, `Drawer`, `IconButton`, `Badge` and `Tabs`.

A popover from the header bell with grouped items and an empty state. It ships now as a shell that renders its designed empty state until the notifications feature wires data ([95](../../../tickets/95-design-system-2.md) section 8).

## Anatomy

```
 header:  ... + (bell 1) O
                ┌──────────────────────────────────────┐
                │ 2 Notifications          3 Mark all read│
                │ [ All ] [ Subscriptions ] [ Replies ]  │ 4
                ├──────────────────────────────────────┤
                │ 5 Today                                │
                │ ◯ Lisbon Walks uploaded "Alfama at 5…" │ 6 item
                │   2 hours ago                    ▢ 7   │
                └──────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Trigger` | `IconButton` with an unread `Badge` (`accent`, string capped by the wrapper, "9+") |
| 2, 3 | `Header` | `title`; a text `Button` for Mark all read |
| 4 | `Filters` | `Tabs` or [ChipBar](chip-bar.md) |
| 5 | `Group` | `overline`, `fg-muted` heading |
| 6 | `Item` | `Avatar` at `avatar.md`, text to three lines, time in `caption`, unread dot in `accent` |
| 7 | `Item` thumbnail | optional 16:9, 96 px wide |

## Props

```ts
// types.ts
export type NotificationCentreLayout = 'popover' | 'sheet';
```

```ts
interface NotificationCentreRootProps {
  layout?: NotificationCentreLayout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unread?: string;
}

interface NotificationCentreItemProps {
  unread?: boolean;
  avatarSrc?: string;
  time: string;
  thumbnailSrc?: string;
  onSelect: () => void;
}
```

`unread` is the finished count string; absent means no badge. `layout` follows the breakpoint. Heading, Mark all read and bell labels come from `useUiCopy()`. An item that navigates takes `asChild` with the wrapper's `Link`.

## Variants

| Layout | Difference |
|---|---|
| `popover` | 400 px wide, 480 px max height, anchored to the bell, `raised`, radius `card`, `elevation-3`, medium and up |
| `sheet` | full-height `Drawer` from the bottom on compact |

## States

| State | What changes |
|---|---|
| closed | bell with or without the badge |
| unread item | `accent-soft` ground, `accent` dot, "unread" in its label |
| empty | an [EmptyState](../../components/empty-state.md) `section` line with one action ("Manage subscriptions") |
| loading, error | five skeleton rows; a [SectionError](../../components/section-error.md) `bar` with retry |
| offline | cached items with a one-line notice |

## Responsive behaviour

Compact: the bell sits in the header, a bottom sheet at 85 % height. Medium: popover 360 px. Expanded and large: 400 px; large shows thumbnails.

## Skeleton

`NotificationCentreSkeleton`: popover 400 by 480 px, header 56 px, five rows 72 px each with a `control.md` circle and bars 100 % and 60 %. Rules in [skeletons](../../components/skeletons.md).

## Motion

Open: fade and 8 px drop at `base` with `enter`; close at `fast` with `exit`. The unread dot fades at `fast`. Keyboard open: no animation. Reduced motion: opacity only.

## Accessibility

- The bell is a button with `aria-expanded` and `aria-haspopup="dialog"`; the unread count is in its name.
- The panel is a non-modal `dialog` as a popover, modal as a sheet; Escape closes and returns focus.
- Items are links in a list grouped by headings; arrows move between them. "All notifications marked as read" is a polite announcement. A notification arriving while open is not announced.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Item` and `Trigger`.
- `useNotificationCentre()` returns `{ open, setOpen, layout }` for an app-local part.
- `tv({ extend: notificationCentreStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `HeaderNotificationCentre` | `notifications/components/` | none | `useNotifications` (empty until the feature lands), `useMarkAllRead`, `useFormat`, `useT` |
| `NotificationRow` | `notifications/components/` | `notification` (typed by the feature that defines it) | `useFormat`, `useT` |

## Used by

[95](../../../tickets/95-design-system-2.md) section 8 shell, with its empty state in every theme and mode; [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) mounts the bell in the header actions.

## Workbench stories

Empty; grouped items with three unread; thumbnail items; loading and error; offline; "9+"; compact sheet; keyboard open; RTL; skeleton.
