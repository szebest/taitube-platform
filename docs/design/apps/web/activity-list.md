# ActivityList

Location: `apps/client/web/src/components/playlist/activity-list/`. Web's app kit, presentational and compound, built from `Avatar`.

A playlist's change history, newest first: who did what, when, and an optional follow-up such as Restore.

## Anatomy

```
┌────────────────────────────────────────────────────┐
│ (A) Ana Costa removed Rain on the Tagus   [Restore] │
│     1 day ago                                       │
│ (B) Bruno Lima added Alfama at 5 a.m.               │
│     2 days ago                                      │
└────────────────────────────────────────────────────┘
```

| Part | Notes |
|---|---|
| `Root` | an `ol`; pass `aria-label` |
| `Item` | a `li` with a hairline below (not the last), a three-column grid |
| `Avatar` | `sm`, monogram fallback; decorative |
| `Text` | `body-sm`, wraps; the finished sentence |
| `Time` | a `time` element, `caption`, `fg-muted`; children are the finished relative or absolute time |
| `Action` | the caller's control, at the end |

## Props

```ts
interface ActivityListAvatarProps extends ComponentPropsWithRef<'span'> {
  src: string | undefined;
  name: string;
}

interface ActivityListTimeProps extends ComponentPropsWithRef<'time'> {
  dateTime: string;
}
```

`Text`, `Action` and the rest take children. The sentence, the displayed time and the button text are finished by the caller; the kit never calls `Intl`. `dateTime` is the machine-readable ISO value.

## Extension points

- `className` on every part.
- `Action` holds any control; an entry with none keeps its two lines.

## States

| State | What changes |
|---|---|
| with action | the control sits at the end, centred on both lines |
| long sentence | wraps, never truncates |
| loading | `ActivityListSkeleton` |
| empty | an `EmptyState` from the caller, not this list |

## Responsive behaviour

The same grid at every breakpoint; the text column takes what the action leaves.

## Skeleton

`ActivityListSkeleton`: four rows, each a `sm` avatar circle and bars at 75 % and 20 % width, with the item hairline. Rules in [skeletons](../../components/skeletons.md).

## Motion

None.

## Accessibility

- An ordered, labelled list: the order is the history.
- `Time` is a real `time` element with `dateTime`.
- The avatar is `aria-hidden`: the sentence names the actor.

## Composition

In the playlist's activity tab or panel; `Action` takes a Button for Restore.

## Used by

web's /playlist page, ticket [119](../../../tickets/119-playlists-customisation-and-collaboration.md).

## Workbench stories

Entries; with restore; long sentence; right-to-left; skeleton.
