# MemberMenu

Location: `apps/client/web/src/components/party/member-menu/`. Web's app kit, presentational, built from `DropdownMenu`, `Drawer`.

The menu on a roster row or a chat author: only the moderation the viewer's ability allows on that member, and the personal controls that change what the viewer sees of them.

## Anatomy

| Group | Items |
|---|---|
| moderation | Mute in chat and Mute in voice (separate, with a duration), Kick, Ban, Make owner, role assignment |
| personal (`MemberPersonalControls`) | Mute their voice, Volume, Hide messages, Hide reactions, Hide avatar, Hide requests, Block invites, Favourite |

## Props

```ts
type MemberMuteScope = 'chat' | 'voice';
type MemberMuteDuration = '10m' | '1h' | 'party';
type MemberControlScope = 'room' | 'everywhere';
```

Each personal control carries a scope: this room only, or everywhere (account, synced to other devices).

## States

| State | What changes |
|---|---|
| allowed | the item |
| not allowed | absent |
| set | the item shows its state and clears in one click |

## Responsive behaviour

A dropdown from medium up, a sheet on compact.

## Accessibility

- Items are menu items with the target's name in the label; Escape closes and returns focus to the row.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyPanel` | `watch-party/components/` | none | `usePartyModeration`, `usePartyControls` |

## Used by

[140](../../../tickets/140-watch-parties.md) sections 2 and 9.

## Workbench stories

Moderator on a member; a plain member; personal controls room and everywhere; muted target.
