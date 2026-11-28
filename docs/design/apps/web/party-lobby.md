# PartyLobby

Location: `apps/client/web/src/components/party/party-lobby/`. Web's app kit, presentational and compound, built from `Avatar`, `Button`, `Progress`.

The stage before playback: the first item's poster with "Waiting to start" or the scheduled countdown, the roster as an avatar grid with ready ticks, and the Start and Ready check actions for whoever holds `playback.control`.

## Anatomy

| Part | Notes |
|---|---|
| `Status` | "Waiting to start", or the countdown to a schedule |
| `Countdown` | the shared 3-2-1 both browsers see before playback |
| `ReadyCheck` | the avatar grid with ticks, "4 of 6 ready", guests as a count |
| `Actions` | Start, Ready; each shown by permission |

## Props

`PartyLobbyMember` is `{ name, avatarUrl, ready }`; `Actions` takes `canStart` and `ready` with their callbacks.

## States

| State | What changes |
|---|---|
| waiting | status and grid |
| scheduled | the countdown to the start time |
| counting down | the shared countdown over the poster |
| ready check | ticks fill in as members press Ready |

## Responsive behaviour

Grid of 48 px avatars wrapping from compact to large; actions stack on compact.

## Accessibility

- The countdown is a polite status updated each second.
- A tick is also text ("ready") on the avatar's label.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyStage` | `watch-party/components/` | none | `usePartyCountdown`, the room socket |

## Used by

[140](../../../tickets/140-watch-parties.md) sections 5 and 11.

## Workbench stories

Waiting; scheduled; counting down; ready check; guests only.
