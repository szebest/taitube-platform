# LinerNotes

Location: `apps/client/web/src/components/watch/liner-notes/`. Web's app kit, presentational and compound, built from `Card`, `Chip`, `Button` and `ScrollArea`.

The description, set like an album's liner notes: a card with the stats line, the creator's notes and a chapter strip. It carries the "Liner notes" signature move.

## Anatomy

```
┌──────────────────────────────────────────────────────────────┐
│ 1 412K views · 2 days ago · #film #lisbon                    │
│ 2 Shot entirely on a Hi8 camcorder over three nights in      │
│   Alfama. No music, only the city. 02:15 is the tram.        │
│   Camera: Sony CCD-TRV16 ...                       3 Show more│
│ 4 [ 00:00 Arrival ] [ 02:15 The tram ] [ 06:40 Rain ] [ > ]  │
└──────────────────────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Meta` | `label`: views, date, tags, finished by the wrapper |
| 2 | `Body` | `body`, 68 ch, three lines collapsed; links and timecodes inline |
| 3 | toggle | Show more and Show less, `accent-ink` |
| 4 | `Chapters` | chips: `mono` timestamp, then the title; the current one is selected |

## Props

```ts
// types.ts
export type LinerNotesLayout = 'card' | 'flat';
```

```ts
interface LinerNotesRootProps {
  layout?: LinerNotesLayout;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onSeek: (seconds: number) => void;
}

interface LinerNotesChapterProps {
  id: string;
  seconds: number;
  time: string;
  thumbnailSrc?: string;
}
```

The notes are children already tokenised by the wrapper (links, timecodes): the kit never parses text. Without `expanded` the card keeps its own state. `onSeek` serves every timecode and chapter. With fewer than two chapters the wrapper omits `Chapters`. Three collapsed lines is a design constant; Show more and Show less come from `useUiCopy()`. A chapter with `thumbnailSrc` shows a 96 by 54 px thumbnail above its title.

## Variants

| Layout | Difference |
|---|---|
| `card` | `surface`, radius `card`, `border.divider`, 16 px padding |
| `flat` | no ground or border, for theater where it sits in the page column |

## States

| State | What changes |
|---|---|
| collapsed, expanded | clamp to three lines, or full notes with chapters wrapping on compact |
| current chapter | `accent-soft` and `accent-ink`, `aria-current="true"`, kept in view |
| no chapters | no strip |
| no description | only the stats line, no toggle |

## Responsive behaviour

Compact: full width, 12 px padding, strip scrolls with a fade, expanded chapters as a vertical list. Medium: 16 px padding. Expanded: inside the left column at 68 ch. Large: chapter thumbnails allowed.

## Skeleton

`LinerNotesSkeleton`: card 100 % by 148 px, padding 16 px, radius `card`; stats bar 220 by 20; three text bars 100 %, 100 %, 64 % by 23; chip row of four pills 112 by `control.sm`. Rules in [skeletons](../../components/skeletons.md).

## Motion

Expand and collapse: `base` with `settle`, animating `grid-template-rows`. Current chapter change `fast`; the strip scrolls it into view at `base`. Reduced motion: instant.

## Accessibility

- A `section` labelled "Description"; the toggle has `aria-expanded` and `aria-controls`.
- Timecodes are buttons named for the action ("Seek to 02:15"); external links add an icon and `rel`.
- The strip is a labelled `nav` of buttons. Collapsed text is clamped visually; the full text stays in the DOM. Tags are links.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Timecode` and on tag links.
- `useLinerNotes()` returns `{ expanded, setExpanded, seek }` for an app-local part such as a "Copy timestamp" button.
- `tv({ extend: linerNotesStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `WatchLinerNotes` | `watch/components/` | `video: Video` | `usePlayerSeek`, `useCurrentChapter`, `useFormat`, `useT`, `useDescriptionTokens` |

`useDescriptionTokens` turns the description into links, tags and `LinerNotes.Timecode` parts; the wrapper also passes the chapters to the seekbar.

## Used by

[59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md): description, timestamps, chapters passed to the seekbar.

## Workbench stories

Collapsed; expanded with links and timecodes; current chapter marked; chapter thumbnails; no chapters; no description; long unbroken URL; compact chapter list; RTL; skeleton.
