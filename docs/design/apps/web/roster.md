# Roster

Location: `apps/client/web/src/components/party/roster/`. Web's app kit, presentational and compound, built from `Avatar`, `Badge`.

The People tab: members grouped by role with a role badge in each role's colour, a sync mark, guests as a count, and a mark where the viewer has a personal control set.

## Anatomy

| Part | Notes |
|---|---|
| `Group` | a role's heading and its members |
| `Member` | avatar, name, `RoleBadge`, sync state, `ControlMark` |
| `RoleBadge` | the role's name in its colour, always with text |
| `Guests` | "N guests" |
| `ControlMark` | an undo mark on a member the viewer muted or hid, one click clears it |

## Props

```ts
type RosterSync = 'lobby' | 'in_sync' | 'catching_up' | 'buffering';
type RosterSource = 'app' | 'activity' | 'discord_chat';
```

## States

| State | What changes |
|---|---|
| in sync | no mark |
| catching up, buffering | a status icon and text |
| controlled | the `ControlMark` |
| empty group | the heading is not drawn |

## Responsive behaviour

A single column in the panel; the member's menu opens from the row.

## Accessibility

- Each row is a button that opens the [MemberMenu](member-menu.md); sync is stated in text, not colour alone.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyPanel` | `watch-party/components/` | none | the roster feed, `usePartyControls` |

## Used by

[140](../../../tickets/140-watch-parties.md) sections 3 and 9.

## Workbench stories

Grouped by role; sync states; guests; discord members; controlled members.
