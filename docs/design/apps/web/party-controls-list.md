# PartyControlsList

Location: `apps/client/web/src/components/party/party-controls-list/`. Web's app kit, presentational and compound, built from `Avatar`, `Button`.

`/settings/party-controls`: every personal control set to apply everywhere, each removable, so a mute the viewer forgot has a place to be undone.

## Anatomy

| Part | Notes |
|---|---|
| `Item` | the member, the controls set, a Remove button |
| `Empty` | "No controls set" and a line saying where they come from |

## Props

`Item` takes the member's name, avatar and a list of control labels.

## States

| State | What changes |
|---|---|
| listed | rows |
| empty | the empty line |
| removing | the row leaves at once, restored on failure |

## Responsive behaviour

One column from compact to large.

## Accessibility

- A list of rows each with a named Remove button; removal is announced politely.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyControlsRow` | `account/components/` | none | `useWatchPartyControls` |

## Used by

[140](../../../tickets/140-watch-parties.md) section 9.

## Workbench stories

Several entries; empty; removing.
