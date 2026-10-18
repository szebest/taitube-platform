# SortableList

A list the viewer reorders by pointer or keyboard, with every move announced; the one reorder behaviour behind web's queue and playlists and studio's Start here pins and category order.

## Anatomy

```
┌ SortableList.Root ───────────────────────────────┐
│ ┌ SortableList.Item ───────────────────────────┐ │
│ │ (1) ⠿  (2) your content               (3) ⋯  │ │
│ └──────────────────────────────────────────────┘ │
│ ┌ SortableList.Item  [picked up]  ─────────────┐ │   raised, elevation 2, dragged with the pointer
│ │ ⠿  your content                              │ │
│ └──────────────────────────────────────────────┘ │
│   ─ ─ ─ ─ ─ ─ drop indicator ─ ─ ─ ─ ─ ─ ─ ─ ─   │   (4)
└──────────────────────────────────────────────────┘
(5) live region (visually hidden)
```

| # | Part | What it is |
|---|---|---|
| 1 | `SortableList.Handle` | the grip (`grip` icon): the only drag start and the keyboard focus target |
| 2 | children | anything: a `VideoThumbnail` row, a category name |
| 3 | caller content | e.g. a row menu; not part of the primitive |
| 4 | drop indicator | a `focus-ring`-coloured line at the target position, `border-focus` thick |
| 5 | live region | announces pick up, each move and the drop or cancel, from `useUiCopy()` |

## API

### types.ts

```ts
import type { Orientation } from '../../types';

export type SortableOrientation = Orientation;
```

```ts
interface SortableListRootProps extends ComponentPropsWithRef<'ul'> {
  items: readonly string[];                       // ids, in order
  onReorder: (next: readonly string[]) => void;    // called once, on drop
  orientation?: SortableOrientation;               // default 'vertical'
}

interface SortableListItemProps extends ComponentPropsWithRef<'li'> {
  id: string;
}

type SortableListHandleProps = ComponentPropsWithRef<'button'>;
```

```tsx
<SortableList.Root items={ids} onReorder={save}>
  {videos.map((video) => (
    <SortableList.Item key={video.id} id={video.id}>
      <SortableList.Handle />
      <QueueRowContent video={video} />
    </SortableList.Item>
  ))}
</SortableList.Root>
```

It is built on `@dnd-kit/core` and `@dnd-kit/sortable` (keyboard sensor, announcements, auto-scroll), imported
nowhere else. The primitive owns only the ordering interaction. The caller owns the data and persistence (an optimistic mutation in the app), so `onReorder` fires once with the final order, never per step.

## Variants and sizes

None. The list takes its look from its children; the picked-up item is `raised` with `elevation-2` and the `card` radius role.

## States

| State | What changes |
|---|---|
| rest | nothing; the handle shows at `fg-muted` |
| handle hover, focus-visible | handle `fg`, focus ring from the `border` set |
| picked up | item `raised`, `elevation-2`, scaled 1.02; others make room with `duration-base`, `ease-settle` |
| moving (keyboard) | the item moves one place per arrow; the indicator shows the target |
| dropped | item settles back over `duration-slow`; `onReorder` fires |
| cancelled (Escape, pointer leaves) | item returns to its place; nothing fires |
| disabled (`aria-disabled` on Root) | handles hidden; the list is static |

## Tokens

Roles `raised`, `fg-muted`, `fg`, `focus-ring`; radius role `card` (picked up) and `sm` (handle); `elevation-2` from the shadow set; `border-focus` from the border set; the handle at `size-control-sm` with the touch target from sizing; motion `duration-base`, `duration-slow`, `ease-settle` (only opacity under the `reduced` motion set).

## Accessibility

- Keyboard: focus a handle; Space or Enter picks the item up; arrow keys (Up and Down, or Start and End for `horizontal`, mirrored in RTL) move it; Space or Enter drops; Escape cancels and restores focus.
- Each step is announced: "Picked up Lisbon at night, position 3 of 12", "Moved to position 4", "Dropped at position 4" or "Cancelled", from `useUiCopy()` keys with the item's accessible name.
- The handle is a real `button` named "Reorder <item name>"; pointer dragging starts only on the handle, so text in the row stays selectable.
- Touch: long-press on the handle starts a drag; the list scrolls when the item nears an edge.

## Do and don't

- Do persist on `onReorder` with an optimistic mutation and roll back on failure.
- Do give each item an accessible name the announcements can use (the visible title).
- Don't make the whole row draggable: only the handle starts a drag.
- Don't call the API per keyboard step; wait for the drop.
- Don't build a second reorder interaction anywhere; compose this one.

## Extension points

`className` on every part; `asChild` on `Handle` to use your own button; `useSortableItem()` gives a custom part the item's `isPickedUp` and position; the `tv()` styles export for `extend`.

## In the workbench

A vertical list of eight rows and a horizontal list of five chips; picked up, moving, dropped and cancelled as `play` interaction stories by keyboard; disabled; RTL horizontal; every theme, mode and the `reduced` motion set.
