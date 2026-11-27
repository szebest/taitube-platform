# PlaylistCover

Location: `apps/client/web/src/components/playlist/playlist-cover/`. Web's app kit, presentational, a single component over a `div` (no parts), built from `Icon` and plain `img` elements.

A playlist's cover as a 16:9 frame made of the thumbnails the caller picked. It is decoration: the playlist's title is always printed beside it.

## Anatomy

```
 0 images        1             2 or 3                4
┌──────────┐  ┌──────────┐  ┌─────┬─────┐       ┌─────┬─────┐
│ playlist │  │          │  │     │  b  │       │  a  │  b  │
│   icon   │  │    a     │  │  a  ├─────┤       ├─────┼─────┤
└──────────┘  └──────────┘  │     │  c  │       │  c  │  d  │
                            └─────┴─────┘       └─────┴─────┘
```

| Count | Layout |
|---|---|
| 0 | empty `tint` frame, `playlist` icon (`lg`) centred, `fg-muted` |
| 1 | the image fills the frame |
| 2 | two columns, one image each |
| 3 | the first image on the left over both rows, the other two stacked on the right |
| 4 | a 2 by 2 mosaic |

More than four URLs: the first four are drawn.

## Props

```ts
interface PlaylistCoverProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  images: readonly string[];
}
```

`images` are thumbnail URLs the caller already chose (a wrapper picks the first four videos' posters). Keys are the URLs, so they must be distinct.

## Extension points

- `className` merged with `cn`; a width on it sizes the frame, the height follows from 16:9.
- `data-count` carries the number of pictures drawn, for a local style.

## States

| State | What changes |
|---|---|
| empty | the icon frame |
| loading images | the `tint` ground shows through each `img` until it loads; `loading="lazy"` |
| loading the playlist | `PlaylistCoverSkeleton` |

## Responsive behaviour

Fills its container's width; radius `thumb` at every breakpoint. The caller sets the width (a card column, the detail header's cover).

## Skeleton

`PlaylistCoverSkeleton`: 100 % wide, 16:9, radius `thumb`. Rules in [skeletons](../../components/skeletons.md).

## Motion

None. Reduced motion changes nothing.

## Accessibility

- `aria-hidden="true"` on the frame, `alt=""` on every image: the cover adds nothing the title does not say.
- It is never the only carrier of meaning and never focusable; a link around it is the caller's.

## Composition

Beside a title in a playlist card, in a detail header, and as the drag preview of a playlist.

## Used by

web's /playlist page, ticket [119](../../../tickets/119-playlists-customisation-and-collaboration.md).

## Workbench stories

Empty; one image; two images; three images; four images; skeleton; right-to-left.
