# CommentItem

Location: `apps/client/web/src/components/discussion/comment-item/`. Web's app kit, presentational and compound, built from `@vp/ui` primitives. Only web renders it today; it moves to `@vp/components` the day studio's comment moderation needs it.

One comment: avatar, author, time, text, reactions and a reply control. It is a shell: the text arrives pre-sanitised and tokenised, and the actions arrive as callbacks.

## Anatomy

```
 ┌────┐ 1 PINNED BY CREATOR
 │ av │ 2 Ines Carvalho   3 3 days ago  4 (edited)
 └────┘ 5 The tram at 02:15 is the best sound design this year.
        6 [ Like 128 ] [ Dislike ]  7 [ Reply ]            8 [ ... ]
        9 View 14 replies
```

| # | Region | Notes |
|---|---|---|
| 1 | Pin label | `overline` in `accent-ink`, only when pinned |
| 2 | Author | `label`; a `Badge` "Creator" when the author owns the video |
| 3 | Time | `caption`, `fg-muted`, link slot to the comment permalink |
| 4 | Edited marker | `caption` in `fg-muted` (`fg-subtle` is not allowed for read text) |
| 5 | Body | `body`, reading measure, mentions, links and timecodes as tokens |
| 6 | Reactions | like and dislike `IconButton`s with the like count in `mono` |
| 7 | Reply | `Button` `ghost` fill, `sm` size |
| 8 | Menu | edit, delete, report; only the actions the app lists |
| 9 | Replies toggle | `accent-ink` button with the reply count |

## Props

Plus the standard props. Author, body and actions are parts; the text arrives as children, tokenised by the app.

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';
import type { ReactionType } from '@vp/domain';

export type CommentLevel = 'comment' | 'reply';
export type CommentState = 'view' | 'editing' | 'pending' | 'failed' | 'deleted' | 'removed';
export type CommentReaction = ReactionType | null;
export type CommentAvatarSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
```

```ts
interface CommentItemRootProps {
  level?: CommentLevel;   // default 'comment'; a reply has no replies panel and a smaller avatar
  state?: CommentState;   // default 'view'
}
interface CommentItemReactionsProps {
  value: CommentReaction;
  likes: string;                          // formatted by the app
  onChange: (next: CommentReaction) => void;
}
// Parts: CommentItem.Root, .Author, .Body, .Timecode, .Reactions, .Reply, .Menu, .Replies, .Pinned, .Failed
```

```tsx
<CommentItem.Root level="comment" state="view">
  <CommentItem.Author name="Ines Carvalho" avatarSrc={avatar} time="3 days ago" dateTime="2026-10-14T09:12:00Z" creator edited />
  <CommentItem.Body>The tram at <CommentItem.Timecode seconds={135} onSeek={seek}>02:15</CommentItem.Timecode> is the best sound design this year.</CommentItem.Body>
  <CommentItem.Reactions value={null} likes="128" onChange={react} />
  <CommentItem.Reply onClick={reply} />
  <CommentItem.Menu>...</CommentItem.Menu>
  <CommentItem.Replies count="14" expanded={open} onToggle={toggle}>{replies}</CommentItem.Replies>
</CommentItem.Root>
```

`state` is one enum for what would otherwise be five booleans. `failed` shows Retry through `<CommentItem.Failed onRetry onDelete />`; `editing` renders the editor passed as a child of `CommentItem.Body`; a pinned comment is `<CommentItem.Pinned />`. The avatar size follows `level` through a `CommentAvatarSize` map (`lg` for a comment, `sm` for a reply, `sm` on compact). Edit and delete are present only when the app passes them in `Menu`; the component does no permission check. Reaction, reply, creator, edited and read-more labels come from `useUiCopy()`.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| Links for the time and mentions | `asChild` on `CommentItem.Author`'s time and on mention anchors |
| A moderation action row in studio | extra children inside `CommentItem.Root`, or a part in studio reading `useCommentItem()` (state, level) |
| An app-local look | `tv({ extend: commentItemStyles, variants: { ... } })` |

## Skeleton

`CommentItemSkeleton`: avatar circle 40 px (32 compact, 24 for a reply), 14 px gap, author bar 120 by 16, body bars 100 % and 72 % by 23, actions bar 140 by 28. Rules in [skeletons](../../components/skeletons.md).

## Variants

| `level` | Difference |
|---|---|
| `comment` | top-level: avatar `lg`, replies panel indented by the avatar width plus `gap-inline` |
| `reply` | avatar `sm`, no further nesting (the thread is two levels), replies panel absent |

## States

| `state` and flags | What changes |
|---|---|
| `view` | as drawn |
| long | bodies over six lines collapse with "Read more" |
| pinned | pin label shown, `accent-soft` left border at the inline start, border focus width |
| `editing` | the body is replaced by the editor child; actions hidden |
| `pending` | just posted: body at 70 % opacity with a `Spinner` in the time slot |
| `failed` | `danger-ink` caption "Not posted" with Retry and Delete buttons |
| `deleted` | the body is replaced by a `fg-muted` line, actions hidden, replies kept |
| `removed` | moderation: as deleted with a different label from the app |
| replies expanded | the replies panel shows under the body |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | avatar `md`, reply indent shrinks to match, actions always visible, menu at `touch-target` |
| medium | avatar `lg` |
| expanded | as medium; actions appear fully |
| large | as expanded; the column is at the reading measure |

## Motion

- Replies panel open and close: height at `base` with `settle`, content fades with `enter`.
- Like toggle: icon scales 1.0 to 1.15 and back at `fast`, count rolls as in [EngagementBar](engagement-bar.md).
- A new comment enters with an 8 px slide and fade at `base`.
- Reduced motion: opacity only, no scale and no roll.

## Accessibility

- An `article` with `aria-labelledby` the author and time; replies are a nested `ul`.
- The time is a `time` element with `datetime` from `dateTime`.
- Reactions are `aria-pressed` toggles named with the count.
- "View 14 replies" is a button with `aria-expanded` and `aria-controls` the panel.
- Timecodes are buttons that call `onSeek`; mentions and links are anchors.
- Failed and pending states are announced once through a polite live region by the thread, not by each item.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `VideoCommentItem` | `watch/components/` | `comment: CommentView` | `useFormat`, `useCan` (edit, delete, report), `useCommentReplies`, `useReactComment`, `useSession`, `useT` |

It fixes `level` from the comment's depth, builds `Menu` from what `useCan` allows, tokenises the body (mentions, links, timecodes) and passes `onSeek` to the player.

## Composition

`Avatar`, `Badge`, `IconButton`, `Button`, `DropdownMenu`, `Spinner`, `Textarea` (through the editing child), `Skeleton`.

## Used by

- Web: [59, watch page](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md): `CommentThread` with pinned first and edit and delete gated by `useCan` in the smart wrapper
- Studio: none today

## Workbench stories

- Plain comment
- Creator comment, pinned
- With mention, link and timecode
- Long comment collapsed and expanded
- Edited
- Editing
- Pending, failed, deleted, removed
- Reply
- With replies expanded
- RTL
- Skeleton
