# PartyChat

Location: `apps/client/web/src/components/party/party-chat/`. Web's app kit, presentational and compound, built from [LiveChat](live-chat.md), `Badge`, `Textarea`.

Room chat, built on [LiveChat](live-chat.md): the list, the pinned line and the composer, with room roles drawn as badges in each role's colour and a composer that says why it cannot send.

## Anatomy

| Part | Notes |
|---|---|
| `Pinned` | the pinned line, from `chat.pin` |
| `List`, `Line` | lines with the author's role badges; a hidden line reads "Hidden message" with Show anyway |
| `Composer` | one field; its state decides what it offers |

## Props

```ts
type PartyChatComposerState = 'open' | 'muted' | 'off' | 'offline' | 'guest';
```

`muted` shows the end time of the mute; `guest` offers "Sign in to chat" and upgrades the seat in place.

## States

| State | What changes |
|---|---|
| open | the field and Send |
| muted | the muted notice with its end time |
| off | "Chat is off in this room" |
| offline | read-only, "Chat is read-only while you are offline" |
| guest | the persistent sign-in bar |

## Responsive behaviour

Fills the panel; on compact the composer pins above the keyboard.

## Accessibility

- Lines are a polite live list; role colour is never the only cue, the badge carries the name.
- The composer's disabled state states its reason in text.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyPanel` | `watch-party/components/` | none | the room socket, personal controls |

## Used by

[140](../../../tickets/140-watch-parties.md) section 6.

## Workbench stories

Open; muted with an end time; off; offline; guest; hidden line; pinned line.
