# PlaylistItemRow

Location: `apps/client/web/src/components/playlist/playlist-item-row/`. Web's app kit, presentational and compound, built from `Checkbox`, `Avatar`, `Tooltip` and `Icon`. The folder also holds [PlaylistSectionRow](#playlistsectionrow), the divider between groups of entries.

One entry of a playlist as the caller draws it inside a `SortableList.Item` (which owns the drag handle and the drag lift): an optional select box, the caller's video row, the adder's note, the clip that plays, and who added it.

## Anatomy

```
┌────────────────────────────────────────────────────┐
│ ::  [ ] ┌────────┐ Lisbon trams, no music        (A) │  Select, Body, Adder
│         │        │ Marta Reis Films                  │
│         └────────┘ ✎ Watch with the sound off        │  Note
│                    ✂ 0:30 to 1:45                    │  Segment
└────────────────────────────────────────────────────┘
```

| Part | Notes |
|---|---|
| `Root` | a `div`, a three-column grid (select, body, adder); `accent-soft` ground when `selected` |
| `Select` | a `Checkbox` in the first column, centred on the whole entry |
| `Body` | the caller's video row, second column |
| `Note` | `body-sm`, `fg-muted`, with an `edit` icon; clamped to three lines |
| `Segment` | a `chip`-radius `tint` label with a `clip` icon, for a finished string such as "0:30 to 1:45" |
| `Adder` | an `xs` `Avatar` in the last column; its label is the accessible name and the tooltip |

## Props

```ts
interface PlaylistItemRowRootProps extends ComponentPropsWithRef<'div'> {
  selected?: boolean;
}

interface PlaylistItemRowSelectProps extends Omit<CheckboxProps, 'checked' | 'onCheckedChange' | 'aria-label'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  'aria-label': string;
}

interface PlaylistItemRowAdderProps extends ComponentPropsWithRef<'span'> {
  src: string | undefined;
  name: string;
  label: string;
}
```

`Body`, `Note` and `Segment` take children only. `selected` writes `data-selected`; the caller owns the selection. The kit holds no copy: the Select's name, the note, the segment and the adder's "Added by X" are finished strings. `name` only supplies the monogram when `src` is missing or fails.

## Extension points

- `className` on every part, merged with `cn`.
- Every part is optional and any part may be left out: a row with no Adder or no Select keeps its columns.
- The caller's video row (`VideoCard` `row`) is the `Body`; a menu or other control sits in the `SortableList.Item` beside the Root.

## States

| State | What changes |
|---|---|
| default | no ground |
| selected | `accent-soft` ground, checkbox checked |
| hover, focus | the video row's own; the Select and Adder have the focus ring |
| picked up | owned by `SortableList.Item` (elevation, drop gap) |
| long note | clamps to three lines with an ellipsis |
| loading | `PlaylistItemRowSkeleton` |

## Responsive behaviour

The grid is the same at every breakpoint; the Body's own `row` card shrinks its thumbnail on compact. The Select keeps the `touch-target` hit area.

## Skeleton

`PlaylistItemRowSkeleton`: padding 4 px, a 120 by 67.5 thumbnail, two text bars (100 % and 66 %), an `xs` avatar circle at the end. Rules in [skeletons](../../components/skeletons.md).

## Motion

The selected ground cross-fades at `fast` with `standard`. Reduced motion: it switches at once.

## Accessibility

- The Root adds no role; the `li` around it is the list item.
- The Select is a labelled checkbox; the label names the video.
- The Adder is `role="img"` with the finished label, focusable (`tabIndex=0`) so the Tooltip opens by keyboard, and the same words are the tooltip.
- The note and the segment are plain text in reading order after the video.

## Composition

Inside `SortableList.Item` in a playlist's list; the Body holds a [VideoCard](video-card.md) `row`.

## Used by

web's /playlist page, ticket [119](../../../tickets/119-playlists-customisation-and-collaboration.md).

## Workbench stories

Plain; with adder; with note and segment; selected for bulk edit; long title and long note; right-to-left; skeleton; section row; section row folded.

---

## PlaylistSectionRow

A divider row that names a section and folds the entries under it.

### Anatomy

```
v Night trams   4 videos                          [...]
```

| Part | Notes |
|---|---|
| `Root` | a `div` with a bottom hairline; `data-folded` when folded |
| `Title` | a button, `title` type, the chevron then the text (truncated); toggles fold |
| `Count` | `caption`, `fg-muted`, a finished string ("4 videos") |
| `Actions` | the caller's menu, pushed to the end |

### Props

```ts
interface PlaylistSectionRowRootProps extends ComponentPropsWithRef<'div'> {
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
}
```

`Root` shares `folded` and `onFoldedChange` with `Title` through context (`usePlaylistSectionRow()`). The kit does not hide the entries: the caller reads its own `folded` and renders or skips them.

### States, motion, accessibility

- Folded: chevron turned to point to the inline end (flipped in right-to-left), `aria-expanded="false"`. Unfolded: chevron down, `aria-expanded="true"`.
- The chevron turns at `fast` with `standard`; reduced motion turns it at once.
- The title is the button's name; Enter and Space toggle. The section's entries are the caller's list, labelled by it.

### Responsive behaviour

One row at every breakpoint; a long title truncates, the count and actions never shrink.
