# WatchTogether

Location: `apps/client/web/src/components/party/watch-together/`. Web's app kit, presentational and compound, built from `ResponsiveModal`, `Checkbox`, `Button`, `Input`, `DropdownMenu`.

The dialog every "Watch together" entry opens: it makes the room as it opens (the `friends` preset, unlisted, the caller's unstarted room for the same source reused) and shows its link, Copy, a QR code, Web Share, who to invite and the room's settings.

## Anatomy

| Part | Notes |
|---|---|
| `Root`, `Trigger` | the trigger is the caller's own button; a guest gets sign-in instead |
| link field | the room URL, or a 24 h invite link when the room is private or has a password |
| Copy | first focus |
| "Start at 12:34" | a checkbox, when the source is a video from a moment |
| "Link skips the password" | on by default for a private or password room |
| QR code | drawn as one SVG path, dark on light, no network |
| Share | the Web Share sheet where the browser has one |
| invite picker | search and an Invite button per person; "Invited" and "In the room" read as text |
| "Host as my channel" | for an account with a channel |
| Room settings | a disclosure: name, who can find it, password, capacity, Allow guests, who can do what with a link to the role editor, schedule, accent colour |
| Go to party | opens the room |

## Props

```ts
type WatchTogetherSource =
  | { kind: 'empty' }
  | { kind: 'video'; videoId: string; startMs?: number }
  | { kind: 'playlist'; playlistId: string }
  | { kind: 'queue'; videoIds: string[]; startIndex?: number };
```

`Root` takes `source` (read when it opens), `container` (the player's fullscreen element, so the dialog shows there) and children.

## States

| State | What changes |
|---|---|
| making the room | a skeleton for the link and the QR |
| ready | the link, Copy focused |
| failed | "Could not make the room" with Try again |
| signed out | sign-in opens, no room is made |
| private or password room | the invite link, with its checkbox |

## Responsive behaviour

A `ResponsiveModal`: a dialog from 600 px, a bottom drawer below.

## Accessibility

- Copy takes focus; Escape closes and returns focus to the trigger.
- The link field is a read-only textbox that selects itself on focus; copying is announced with a toast.
- The QR code is an image named "QR code of the party link".

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder | Props | Hooks |
|---|---|---|---|
| `WatchTogetherMenuItem` | `components/party/` | `videoId` | `useRequireAccount`, the `watch-together` URL modal |
| entries: `WatchEngagementBar`, the player control bar, `WatchQueue`, `PlaylistHero`, `ClipPage`, the video card menus, the command palette | `watch`, `library`, `search` | the source | `useRequireAccount` |

## Used by

[140](../../../tickets/140-watch-parties.md) sections 8 and 10.

## Workbench stories

Trigger; making the room; ready; failed; starts at the playhead; signed out; menu item.
