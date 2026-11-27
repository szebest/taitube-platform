# CollaboratorList

Location: `apps/client/web/src/components/playlist/collaborator-list/`. Web's app kit, presentational and compound, built from `Avatar`.

The people who can edit a playlist: the owner and the collaborators, each with a line of context and the caller's role and remove controls.

## Anatomy

```
┌────────────────────────────────────────────────────┐
│ (A) Ana Costa                                       │  owner, no actions
│     Owner                                           │
│ (B) Bruno Lima                  [Editor v]  [x]    │
│     Joined 3 days ago                               │
└────────────────────────────────────────────────────┘
```

| Part | Notes |
|---|---|
| `Root` | a `ul`; pass `aria-label` |
| `Item` | a `li`, a three-column grid: avatar, text, actions |
| `Avatar` | `md`, monogram fallback; decorative |
| `Name` | `label`, truncates |
| `Meta` | `caption`, `fg-muted`, finished string ("Owner", "Joined 3 days ago") |
| `Actions` | the caller's role `Select` and remove button, at the end, centred on both lines |

## Props

```ts
interface CollaboratorListAvatarProps extends ComponentPropsWithRef<'span'> {
  src: string | undefined;
  name: string;
}
```

`Root` is a `ul` and `Item` an `li` with their native props; `Name`, `Meta` and `Actions` take children. The kit holds no copy and formats nothing: dates and role names arrive as strings.

## Extension points

- `className` on every part.
- `Actions` takes any controls; `Meta` and `Actions` may be left out (the owner's row).

## States

| State | What changes |
|---|---|
| no actions | the text uses the row's width |
| long name | truncates, the actions stay |
| no avatar image | the monogram of `name` |
| loading | `CollaboratorListSkeleton` |

## Responsive behaviour

The same grid at every breakpoint; the name truncates before the actions wrap.

## Skeleton

`CollaboratorListSkeleton`: three rows, each a `md` avatar circle, bars at 33 % and 25 % width, and a 96 px wide `control.sm` block. Rules in [skeletons](../../components/skeletons.md).

## Motion

None.

## Accessibility

- A labelled list; each person is one item.
- The avatar is `aria-hidden`: the name is printed beside it.
- Role select and remove button are the caller's and carry names that include the person.

## Composition

In the playlist's sharing dialog or panel, above an invite field.

## Used by

web's /playlist page, ticket [119](../../../tickets/119-playlists-customisation-and-collaboration.md).

## Workbench stories

Owner and collaborators; long name; no meta; right-to-left; skeleton.
