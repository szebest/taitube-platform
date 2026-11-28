# PartyQueue

Location: `apps/client/web/src/components/party/party-queue/`. Web's app kit, presentational and compound, built from [Queue](queue.md), `Button`, `Dialog`.

The room's shared queue: who added each item, reorder and remove by permission, and an add control that appears only for a member who holds `queue.add`.

## Anatomy

| Part | Notes |
|---|---|
| `List`, `Item` | a video row with "Added by {name}", the playing item marked |
| `Add` | paste a link or choose from the viewer's own queue |
| `Empty` | "The queue is empty" with the add control where allowed |

## Props

`Item` takes `onMove`, `onRemove` only where the viewer's ability lets them; `Add` is absent otherwise.

## States

| State | What changes |
|---|---|
| playing | the current item marked, now playing |
| editable | grip and remove on each row |
| read-only | rows only |
| empty | the empty line |
| full | the add control reports the room's limit |

## Responsive behaviour

Same list in the panel at every layout; rows keep 44 px targets.

## Accessibility

- Reorder works by keyboard (Space to pick up, arrows, Space to drop) as in [Queue](queue.md).
- A control the viewer lacks the permission for is absent, not disabled.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyQueueTab` | `watch-party/components/` | none | `usePartyQueueEdits`, `usePartyCan` |

## Used by

[140](../../../tickets/140-watch-parties.md) section 7.

## Workbench stories

Playing and queued; read-only; empty; add dialog; full.
