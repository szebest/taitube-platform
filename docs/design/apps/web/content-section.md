# ContentSection

Location: `apps/client/web/src/components/channel/content-section/`, presentational and compound, built on [Shelf](shelf.md) for the shelf layout. It lives in web's kit because only web renders it; it moves to `@kit/components` when the studio's section preview needs it too.

One section of a channel page, laid out as the creator chose. It is the single component over every layout of a content section, so a card never knows which layout holds it.

## Anatomy

```
 1 Season one                      2 Start with the pilot            3 See all >
 4 ┌──────┐ ┌──────┐ ┌──────┐
   │ item │ │ item │ │ item │      (shelf, grid, list, hero or masonry)
   └──────┘ └──────┘ └──────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Title` | an `h2` that names the section |
| 2 | `Subtitle` | the creator's line, `fg-muted` |
| 3 | `Action` | the link slot to the tab "See all" points at |
| 4 | `Items` and `Item` | a list; the layout decides how it flows |

## Props

```ts
// types.ts
export type ContentSectionLayout = Extract<ResolvedSectionView, { kind: 'content' }>['layout'];
export type ContentSectionDensity = ContentSectionView['presentation']['density'];
```

```ts
interface ContentSectionRootProps {
  layout: ContentSectionLayout;
  density: ContentSectionDensity;
  shelfVariant?: ShelfVariant;
}
```

`Header`, `Title`, `Subtitle`, `Action`, `Items` and `Item` read the layout from the root. For `shelf` they are the Shelf's own parts; for the other layouts they are plain elements with the Shelf's heading styles, so every layout has the same heading row.

## Layouts

| Layout | Items flow |
|---|---|
| `shelf` | the [Shelf](shelf.md) track, `shelfVariant` picks card, poster (Shorts) or channel tiles |
| `grid` | 2 to 6 columns at the expanded width, fewer below it, never fewer than one |
| `list` | one column of row cards |
| `hero` | one large item |
| `masonry` | CSS columns, one to three, items never split (posts) |

`density` sets the gap: `compact` is `gap-inline`, `comfortable` is `gap-stack`; the wrapper passes the same value to the cards, which read it for their size.

## States

| State | What changes |
|---|---|
| no items | the section is not rendered; the resolver already dropped an empty `hideWhenEmpty` section |
| accent | the wrapper puts the section inside `BrandScope` with the section accent, below the viewer's own accent |
| backdrop | the wrapper puts [SectionBackdrop](section-backdrop.md) around the section |

## Accessibility

A `section` named by its `Title`. Layouts keep the DOM order, so reading order is the creator's order; a shelf keeps the Shelf's keyboard behaviour. Masonry columns do not reorder the list.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props |
|---|---|---|
| `PageSection` | `channel/components/` | `section`, `handle`, `images` |

It maps a resolved section to the layout, the card variant and the heading, and passes `density` and the `show` flags to `PageItemCard`.

## Used by

[121](../../../tickets/121-channel-page-builder.md) the channel page and its custom tabs.
