# PartyJoinPanel

Location: `apps/client/web/src/components/party/party-join-panel/`. Web's app kit, presentational, built from `Avatar`, `Button`, `Field`, `Input`.

What a visitor with no seat sees on a party URL: the room, who is in it, and the one way in the room allows. It is also where an invite from the bell lands when the room is full or has a password.

## Anatomy

| Part | Notes |
|---|---|
| poster | the current video at 16:9 |
| heading | room name, owner byline, video title |
| faces | up to five avatars and "N here" |
| notice | banned, guests off, closed, not found, or "This party is full (10 of 10)" |
| password form | a `Field` with the error under it |
| actions | Join, Watch as guest, Join with Discord (only when 78's integration is configured), Sign in, Watch on your own |

## Props

```ts
type PartyJoinState = 'yes' | 'password' | 'full' | 'banned' | 'guests_off' | 'closed' | 'not_found';
type PartyJoinAction = 'guest' | 'discord' | 'sign_in';
type PartyPasswordError = 'invalid' | 'locked';
```

`spotOpened` says "A spot opened up" once a full room has a seat free.

## States

| State | What changes |
|---|---|
| yes | Join, or the preview's actions |
| password | the form; Join disabled while empty or locked |
| full | Join disabled, the count; the wrapper polls every 5 s and enables Join with `spotOpened` |
| banned, guests off, closed, not found | the notice and no Join |

## Responsive behaviour

One column, `prose` wide, centred; actions wrap.

## Accessibility

- The panel is a `section` named by the room; the password error is tied to its field.
- "A spot opened up" is a polite status.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyJoin` | `watch-party/components/` | `roomId`, `preview`, `invite?` | `useJoinParty`, `useJoinPartyAsGuest` |

## Used by

[140](../../../tickets/140-watch-parties.md) sections 4 and 11, and 8 for the invite landing.

## Workbench stories

Guest and sign-in; with Discord; signed in; guests off; password; wrong password; locked out; full; spot opened; banned; closed; not found.
