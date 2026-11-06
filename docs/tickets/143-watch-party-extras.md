# 143: Watch party extras - play, memory, social, creator and safety features on top of the room engine

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Issue | TBD |
| Size | XL |
| Blocked by | 105 - Clips · 111 - Captions and transcripts · 140 - Watch parties · 141 - Watch party voice chat |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §10 Real-time status](../SDD.md#10-real-time-status-sse) · [SDD P9 Local-first](../SDD.md#13-design-principles-used-to-break-ties-throughout) |

**Status:** blocked

> **Why.** [140](140-watch-parties.md) builds the room, its clock, roles, roster, chat and queue; [141](141-watch-party-voice-chat.md)
> adds voice. Those make a party work. This ticket makes it fun and memorable, and ties it into the rest of the app,
> without growing 140 past its three slices. Every item below rides 140's socket, roles and roster; none adds a
> transport, an identity or a service.

> **How items plug in.** A feature that needs a permission adds one entry to 140's registry (its `since` the next
> version, defaults per built-in role and preset), so `upgradeRoomRoles` gives existing rooms the defaults and the role
> editor shows it with no migration. A feature that needs a frame adds a member to 140's socket unions. A feature a room
> can turn off is a room setting under `room.edit`.

## What to build

### 1. Play (slice a)

| Feature | What ships | Permissions and limits |
|---|---|---|
| Flying timed comments | An opt-in overlay (danmaku style) where chat lines marked "fly" cross the video at the moment they were sent; stored with `position_ms` (140 already records it), so they replay on the video later for anyone who turns on "Party comments" on the watch page for that party's recording window. Lanes, speed and density are viewer settings; reduced motion shows them as a static strip | new `chat.fly` (Member in both presets); 1 per 5 s per member; personal "hide reactions" (140 section 9) hides a member's |
| Reaction bursts and confetti | When a room's reactions pass a threshold in 2 s, a burst plays (confetti on the motion tokens, static under reduced motion), and the moment is marked for the heatmap | no new permission; folded server-side like 140's reactions |
| Polls and predictions | A poll (2 to 4 options, 30 s to 10 min) or a "what happens next" prediction a holder can open; results live, predictions revealed when the holder resolves them; stored for the recap | new `chat.poll` (Co-host, Moderator; DJ in `public`) |
| Next video vote and roulette | At the end of an item, 3 suggestions (from the queue, then 100's related ranking) and a 20 s vote; roulette picks one of the queue at random with a spin animation | new `queue.suggest` (everyone with `queue.vote`); the winner is added through 140's queue path |
| Instant replay | Anyone with `queue.vote` starts a "rewind 10 s" vote; at 50 % of present voters the room seeks back 10 s once | rate-limited to one vote per 60 s per room |
| Lobby trivia and mini-games | While in `lobby`, a trivia round from the first video's chapters, tags and description (generated locally from the video's own data, no external API), and a reaction-speed game; scores shown in the lobby only | runs only in `lobby`; `playback.control` starts and stops it |
| Soundboard | A fixed set of short sounds in the catalogue (licensed with the repo, no upload in this ticket), played to the room in sync | new `chat.soundboard` (Co-host, VIP; not Member); 1 per 10 s per member, 1 per 2 s per room; personal "hide reactions" mutes it for the viewer |
| Karaoke mode | For a video with captions (111), a room toggle shows large centred captions with the current line highlighted, for everyone | `room.edit`; uses 111's cues as they are |
| Theater seat row | An optional row of seat avatars under the stage, with each member's last reaction floating above their seat for 2 s; guests as one "+N" seat | viewer layout setting (140's `party` section) |
| Telestrator | While paused, a holder draws on the frame (pen, arrow, circle, 3 colours); strokes broadcast as vector frames and clear on play | new `playback.draw` (Co-host, DJ); 30 strokes per minute |
| Watch bingo | A 3 by 3 card per member generated from the video's chapters and tags; members tick squares, the first line wins a chat shout-out | `chat.post` |
| "3, 2, 1, react" moments | A holder triggers a countdown; reactions in the next 3 s count toward one big burst | `playback.control` |

### 2. Memory and social (slice b)

| Feature | What ships | Notes |
|---|---|---|
| Party history | `/feed/parties` lists the parties an account was in (30 days), with who was there (140's preview rules), what played and for how long | accounts only; respects 140's retention, so the room row's 30 days bound it |
| Chat replay | On a past party's page, the chat replays against the video using `position_ms`, like 76's live chat replay | the party's messages within 140's 7-day message retention; history extends message retention to 30 days for rooms whose owner turns on "Keep this party's history" |
| Reaction heatmap | A strip over the timeline of a past party showing where reactions, bursts and flying comments peaked | from stored reaction counts per 5 s bucket (a new small table, written by the reaction fold) |
| Recap card | At the end, a card: time watched together, videos played, top reactor, most-reacted moment (a still and the timestamp), poll winners; shareable as an image (rendered in the browser, no service) and a link | members see their own stats; others only appear if `showInParties` allows |
| Rewatch with the same group | "Start again with this group" on a past party creates a new room with the same queue and invites everyone who was there with an account | 140's invite path and limits |
| Badges and achievements | A small set: first party hosted, 10 parties attended, 100 reactions, a marathon (3 hours), a full-house host; shown on the profile when the user opts in | accounts only; no streaks or loss mechanics |
| Friends watching now | A home shelf and a rail entry showing open rooms where people the viewer subscribes to, or partied with in the last 30 days, are present and allow being shown | reuses 140's preview projection and discovery query |
| Follow a host | "Notify me when Ana hosts" on a host's card or party; a `party_hosting` notification when they open a public or unlisted room or schedule one | a new 99 kind, through the outbox, grouped per host |
| Save the queue as a playlist | One action on the queue that creates a private playlist from it | 73's playlist write path |
| Start a party from a channel page or a search result | A "Watch together" action on channel page sections and search result cards | 140's dialog |
| Rooms in global search | A `party` kind in 47's results for open public rooms | only once rooms prove long-lived enough; behind a flag until then |
| Party in the now playing bar and picture-in-picture | Leaving the party page keeps the socket and plays the party in 73's now playing bar, still in sync, with a "Back to party" action; the browser's picture-in-picture keeps sync too | the bar gains a party mode through the player port |
| Role templates | Save a room's role set as a template and apply it to a new room | accounts; templates are private to their owner |
| A phone as the remote | Scanning the room's QR on a second device of the same member opens a remote view (play, pause, seek, queue, chat) that drives the room while the big screen plays; it does not take a second seat | the same member key on two sockets, one marked `remote`, an exception to 140's supersede rule for that mode only |
| Room captions language | A room default captions language from 111's tracks, which each viewer can override | `room.edit` |

### 3. Creator and safety (slice c)

| Feature | What ships | Notes |
|---|---|---|
| Creator premieres | A creator schedules a first showing of a new video as a public room hosted as their channel, with a countdown, the creator as Owner, a `premiere` notification to subscribers through 99 and a "Premiere" shelf; the video stays private until the room starts, then becomes public | the studio gets a "Premiere" option in the publish flow |
| Live broadcasts in a room | A `LIVE` video may be queued; the room follows the live edge instead of a clock position, and the room chat sits beside 76's live chat | sync is "everyone at the live edge"; seeking is off |
| Creator watch-alongs | A creator hosts a room over any public video (theirs or not) with their commentary in 141's voice as the only Speaker, listed in a "Watch-alongs" shelf | the `public` preset plus Speaker for the creator |
| Party views in studio analytics | A creator sees how many views of their videos came from parties, the peak party size and the most-reacted moments | from 65's beacon with a `party` context field |
| Clip a moment in the party | 105's clip dialog opened from the party, the clip dropped into chat as a card | `chat.post` |
| Transcript jump | Search the video's transcript (111) from the party and seek the room to a line, or request it | `playback.control` or `playback.request` |
| Room word filter and link blocking | Blocked words and link rules in room settings, reusing 113's blocked-words engine once it lands | `room.edit` |
| A reported rooms and members queue | In the admin panel (61), a queue of reported rooms and members with the reports and the room's recent chat, with close, hide and dismiss | MODERATOR, ADMIN |
| Raid protection | One owner or Co-host toggle that turns guests off, sets slow mode to 30 s and Member to chat-only for 10 minutes | `room.edit` |
| Account-age and verified-only joins | A public room can require accounts older than 24 h, or verified email, for anyone joining as Member | `room.edit`; guests are unaffected by age (they cannot act anyway) |

## What is not here, and why

- Sponsored or featured rooms: there is no ads or sponsorship system to sell or label them.
- Cast to a TV: Chromecast's sender SDK loads from Google's servers, which breaks local-first; AirPlay already works
  through the native video element.
- A people graph (follow a person, friends): a platform feature far bigger than parties.
- Live captions of voice: needs streaming speech-to-text, which 111 left out.
- Anything Discord: [142](142-discord-party-bridge.md).

## Acceptance criteria

- [ ] Every new permission (`chat.fly`, `chat.poll`, `chat.soundboard`, `queue.suggest`, `playback.draw`) is a registry
      entry with its defaults, an existing room gains it on load through `upgradeRoomRoles`, and 140's per-permission
      enforcement spec covers it.
- [ ] Flying comments render at their moment in the party and replay on the watch page for that window; the overlay is
      off by default and static under reduced motion; a member's are hidden for a viewer who hid that member's
      reactions.
- [ ] A poll, a prediction, a next-video vote, roulette and an instant replay each run in a two-browser e2e with their
      limits refused on the server.
- [ ] The soundboard is refused without `chat.soundboard` and past its budgets, and a viewer's personal mute silences it.
- [ ] Karaoke mode shows 111's cues large for everyone in sync; telestrator strokes reach every member and clear on play.
- [ ] Party history lists only the viewer's own parties, the chat replays at its positions, the heatmap matches seeded
      reactions, and the recap card shows only people whose `showInParties` allows it.
- [ ] Following a host produces one grouped `party_hosting` notification when they open or schedule a room.
- [ ] The party keeps playing in sync in the now playing bar after leaving the party page, and the phone remote drives the
      room without taking a second seat.
- [ ] A premiere keeps its video private until the room starts, notifies subscribers, and opens with a countdown.
- [ ] Raid protection applies its three changes in one action and reverts after 10 minutes.
- [ ] Every new surface meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts` (no
      diff) green, with output in the PR.

## Delivery

One stack, `feat/143-watch-party-extras`, three slices: (a) play, (b) memory and social, (c) creator and safety, each as
listed above. A slice that grows past one reviewable PR at pickup is split into its own ticket then, rather than a fourth
slice.

## Out of scope

The "not here" list above.

## Testing plan

- Each new permission in 140's enforcement spec; each new frame in the contract specs.
- Two-browser e2e per play feature; the recap and heatmap as specs over seeded rooms.
- Premieres through the studio flow with the in-memory adapters.

## Open questions

None.

- Decided: these features live in their own ticket so 140 stays three slices; each plugs into 140's registry, socket and
  roster rather than adding infrastructure.
- Decided: trivia is generated from the video's own data, never from an external API, to stay local-first.
- Decided: sounds for the soundboard are a fixed, licensed set in the catalogue; user uploads are not in this ticket.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PRs.
- [ ] `docs/SDD.md` (§6.1, 140's §10.7 frames, §10.4 the new notification kinds), `README.md` and the design docs for each
      new surface updated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
