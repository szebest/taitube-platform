# PartyRoom

Location: `apps/client/web/src/components/party/party-room/`. Web's app kit, presentational and compound, built from `SegmentedControl`, `Tabs`, `IconButton`, `Badge`, [LiveChat](live-chat.md).

The room page's frame: the stage with the room header above it, a 360 px panel with the Chat, People and Queue tabs, and an overlay that carries chat over the picture in focus and fullscreen.

## Anatomy

```
 ┌────────────────────────────────────────────┬──────────────┐
 │ 1 Header: name · owner · phase · 6 here    │ 4 Tabs       │
 │          [Invite] [Settings] [Layout]      │ Chat People Queue│
 ├────────────────────────────────────────────┤ 5 TabPanel   │
 │ 2 Stage (player, ambient glow)             │              │
 │ 3 reactions bar (e3)                        │              │
 └────────────────────────────────────────────┴──────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Header` | `title` (room name), owner byline, phase badge, present count, then actions: Invite, Settings (for `room.edit` or `roles.manage`), Layout menu |
| 2 | `Stage` | the player, never resized by the panel's content |
| 4, 5 | `Tabs`, `TabPanel` | `SegmentedControl` on compact, `Tabs` from medium |
| | `Panel` | 360 px at inline-end in `side`, full width below the stage in `below` and `theater` |
| | `Overlay` | live-chat lines over the picture in `focus` and fullscreen, with 76's opacity slider |

## Props

```ts
export type PartyRoomLayout = 'side' | 'below' | 'theater' | 'focus';
export type PartyRoomTab = 'chat' | 'people' | 'queue';
```

`Root` takes `layout`; the active tab is the wrapper's state, persisted through 97.

## States

| State | What changes |
|---|---|
| side, below | panel at inline-end, or below the stage |
| theater | stage full width, panel below |
| focus | panels hidden, chat as the overlay |
| lobby | the stage shows the poster and [PartyLobby](party-lobby.md) |
| loading, error, offline | stage skeleton at 16:9; a [SectionError](../../components/section-error.md) `bar`; chat read-only with a one-line notice |

## Responsive behaviour

Expanded and large: stage with the 360 px panel. Medium: panel below. Compact: the player sticks at the top at 16:9, a `SegmentedControl` picks Chat, People or Queue, the composer pins above the keyboard (`dvh`), landscape goes fullscreen with the overlay.

## Accessibility

- The panel is a `region` named "Party panel"; tabs follow the tabs pattern, arrows move between them.
- Chat lines are a polite live list; the overlay's lines are not announced twice.
- Layout changes keep focus on the control that made them.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyRoomView` | `watch-party/components/` | `roomId`, `preview` | `usePartySync`, `usePartyClock`, `useRequireAccount` |
| `PartyStage`, `PartyPanel`, `PartyLayoutMenu` | `watch-party/components/` | none | the room socket, the layout preference |

## Used by

[140](../../../tickets/140-watch-parties.md) sections 5 and 11.

## Workbench stories

Side, below, theater, focus; lobby; compact portrait and landscape; loading; error; offline.
