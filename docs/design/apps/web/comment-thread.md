# CommentThread

Location: `apps/client/web/src/components/watch/comment-thread/`. Web's app kit, presentational and compound, built from [CommentItem](comment-item.md) (same kit, `discussion`), `Textarea`, `SegmentedControl` and `Drawer`.

The discussion section: header with count and sort, the composer, the top-level comments with their reply threads, and the footer that loads more. It is a shell around [CommentItem](comment-item.md); data, pagination and permissions stay in the wrapper.

## Anatomy

```
 1 Discussion · 1,284                         2 [ Top | Newest ]
 ┌────┐ ┌────────────────────────────────────────────────┐
 │ me │ │ 3 Add a comment...                              │
 └────┘ └────────────────────────────────────────────────┘
                                     4 [ Cancel ] [ Comment ]
 5 comment item (pinned first)
   6 replies, indented, collapsed by default
 7 [ Show more comments ]
```

| # | Part | Notes |
|---|---|---|
| 1 | `Header` | `title-lg`, count already formatted |
| 2 | `Header` sort | `SegmentedControl`: Top and Newest |
| 3 | `Composer` | one-row `Textarea` that grows; viewer avatar at `avatar.lg` |
| 4 | composer actions | on focus or when text is present |
| 5, 6 | `Item` | `CommentItem`s, pinned first; a nested list per item for replies |
| 7 | `More` | "Show more comments", or a sentinel for automatic loading |

## Props

```ts
// types.ts
import type { CommentSort } from '@vp/domain';

export type CommentThreadLayout = 'inline' | 'sheet';
export type CommentThreadSort = CommentSort;
```

```ts
interface CommentThreadRootProps {
  layout?: CommentThreadLayout;
  sort: CommentThreadSort;
  onSortChange: (sort: CommentThreadSort) => void;
  onEndReached?: () => void;
}

interface CommentThreadComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  viewerAvatar?: string;
  submitting?: boolean;
  error?: string;
}
```

The sort is controlled so the wrapper resets it with the video. Empty, error, disabled and signed-out are the wrapper rendering [EmptyState](../../components/empty-state.md), [SectionError](../../components/section-error.md), a message or a sign-in prompt in place of the composer or items, so there is no status prop. Loading is skeleton items. Sort, composer and Show more labels come from `useUiCopy()`.

## Variants

| Layout | Difference |
|---|---|
| `inline` | in the page column below the liner notes |
| `sheet` | in a `Drawer` for Shorts: the composer sticks to the bottom, the list scrolls |

## States

| State | What changes |
|---|---|
| empty | an editorial line ("Nobody has said anything yet") and an action that focuses the composer |
| error | `SectionError` with retry replaces the list; the heading stays and the video keeps playing |
| disabled | comments off: a message in the list area, no composer |
| signed out | a sign-in prompt in place of the composer |
| submitting | composer read-only, `Spinner` in the button, the new comment at the top as `pending` |
| composer error | text in `danger-ink` with an icon under the field |
| loading more | a trailing three-row skeleton, `aria-busy` on the list |

## Responsive behaviour

Compact: heading and sort stack, composer actions full width, compact avatars. Medium: one-row heading. Expanded and large: left column, text at 68 ch. The section reserves its skeleton height so loading shifts nothing above it (CLS under 0.05).

## Skeleton

`CommentThreadSkeleton`: header bar 220 by 28; composer row with a 40 px circle and a 100 % by `control.md` field; five `CommentItemSkeleton`s at 20 px gap. Each item: 40 px circle (32 compact, 24 reply), 14 px gap, author bar 120 by 16, body bars 100 % and 72 % by 23, actions bar 140 by 28. Rules in [skeletons](../../components/skeletons.md).

## Motion

New and pending comments enter at the top at `base` with `enter`; the rest do not move. Composer expand `base` with `settle`. A sort change crossfades at `fast`. Reduced motion: opacity only.

## Accessibility

- A `section` labelled by the heading; the list is a `ul`; sort is a radio group.
- The composer is a labelled `textarea`; Ctrl or Cmd Enter submits; Escape leaves it, after a confirm when text is present.
- A polite live region announces "Comment posted" or "Failed to post". After posting, focus returns to the composer; after loading more it stays on the button.
- Pinned and creator markers carry text.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Header` and `More`.
- `useCommentThread()` returns `{ layout, sort, setSort }` for an app-local part.
- `tv({ extend: commentThreadStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `WatchCommentThread` | `watch/components/` | `videoId: string` | `useComments(videoId, sort)`, `usePostComment`, `useSession`, `useCan`, `useFormat`, `useT` |
| `ShortsCommentSheet` | `shorts/components/` | `videoId: string` | the same, fixed to `layout="sheet"` |
| `VideoCommentItem` | `watch/components/` | `comment: CommentView` | `useFormat`, `useCan`, `useCommentReplies`, `useReactComment` |

The wrappers own an error boundary around the section, so a failing discussion never takes the player with it.

## Used by

[59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) discussion with its own boundary; the Shorts discussion sheet in [95](../../../tickets/95-design-system-2.md) section 8.

## Workbench stories

Pinned first; loading; empty; error; comments disabled; signed out; composer focused; submitting and failing; loading more; sheet; RTL; skeleton.
