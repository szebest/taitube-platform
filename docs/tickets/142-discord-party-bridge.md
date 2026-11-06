# 142: Discord party bridge - chat relayed both ways, a live party embed, Scheduled Events and role mapping

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Issue | TBD |
| Size | M |
| Blocked by | 78 - Discord integration · 140 - Watch parties |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) · [SDD P9 Local-first](../SDD.md#13-design-principles-used-to-break-ties-throughout) |

**Status:** blocked

> **Why.** A watch party often lives half in Discord: friends sit in a voice channel and a text channel there while others
> join from the app. [78](78-discord-integration-bot-watch-together-activity-creator-alerts.md) brings Discord people
> into a [140](140-watch-parties.md) room (the Activity, "Join with Discord", the `/party` command); this ticket connects
> a party to a Discord server's text channel so both sides see one conversation and one roster. Voice is not relayed:
> Discord members talk in Discord through the Activity's voice channel, and app members in [141](141-watch-party-voice-chat.md)'s voice.

> **Optional and off.** Everything here needs 78's Discord configuration plus its own switches, all off in
> `.env.example`; the bridge is a separate deployable in a `discord` compose profile, so the default `make up` and
> `make smoke-offline` never start it, and its tests run against a fake Discord gateway and REST API with no network.

## What already works, and what this adds

- **Playback sync between the Activity and web members**: done by 140 and 78. The Activity is a client of the 140 room
  socket, so a pause from a web member and from the Activity are the same command on the same room clock. Nothing to
  build; an e2e here proves it end to end with a fake Activity client.
- **Discord identity**: 78's Discord party credentials (the Activity's verified identity and "Join with Discord"); this
  ticket adds **bot-relayed identity** for people who only use Discord's own text chat.

## What to build

### 1. The bridge runtime and linking

- A new deployable `apps/server/discord-bridge` (Node 24, like the API; the dual-runtime rule binds the worker and the
  shared packages, not this app). It holds the Discord Gateway connection
  that 78's HTTP interactions do not, with the `GUILDS`, `GUILD_MESSAGES` and Message Content intents (Message Content is privileged: free under 100 servers, and above that it needs Discord's review, which the
  runbook notes).
- **Linking a party to Discord**: `/party link` in a text channel (by a Discord user whose linked Taitube account holds
  `room.edit` in the room), or "Link a Discord channel" in room settings. A row in `discord_party_links` (`room_id`,
  `guild_id`, `text_channel_id`, `webhook_id`, `created_by`, `created_at`); one active link per room.
  The bot announces in the channel: "This channel is bridged to the Taitube watch party <name>: messages here are
  relayed to people in the party."
- **Bot-relayed identity**: the bridge calls the API's internal party endpoints with a service credential
  (`DISCORD_BRIDGE_TOKEN`, secret-shaped, no default) and names the Discord principal (`discord:<id>`, name, avatar) of
  each line it relays. Only the bridge's credential may assert a Discord principal this way, and only for a
  linked room. Bans, mutes, roles and budgets on that member key apply exactly as for an Activity member.

### 2. The chat bridge

- **Discord -> party**: a message in the linked text channel becomes a room chat line with `source: discord` and author
  `discord:<id>`, through 140's chat path, so `chat.post`, Chat muted, bans, slow mode and the burst budget all apply. A
  refused line is not relayed, and the bot adds a reaction to the Discord message saying why (muted, banned, slow mode),
  once per person per minute.
- **Party -> Discord**: app lines are posted through the channel webhook with the author's name and avatar (an avatar
  URL Discord cannot reach, as on a local stack, falls back to the default) and a source suffix ("via Taitube"); guests
  never post, so nothing of theirs is relayed. Above Discord's webhook rate, lines are merged into one message every 2 s.
- **Moderation carries across**: a line removed in the room deletes its mirrored Discord message; a Discord message
  deleted in Discord removes its room line; a member banned or chat-muted in the room is not relayed from Discord; a
  Discord timeout already stops them posting there.
- Mentions, attachments and embeds are flattened to text and links; nothing is downloaded.

### 3. The live party embed

- `/party` (78) and a linked room post a regular channel message (not an interaction reply, whose token expires after 15
  minutes) that the bot edits on change, at most every 15 s: room name, now playing with its thumbnail and position,
  phase, the roster through 140's `toRosterPreview` with Discord's naming rule (up to 10 names: accounts that allow it,
  Discord members by their Discord name, everyone else as "+N", split by source), counts by source and a Join link button. On close it becomes "Party ended".

### 4. Scheduled Events

- A linked room's schedule (140's `room.schedule`) creates a Discord Scheduled Event in the guild (external, its location
  the party URL), updates it on reschedule and cancels it on close;
  the bot needs Manage Events and says so when it lacks it.

### 5. Role mapping

- `discord_party_role_maps` (`room_id`, `discord_role_id`, `party_role_id`), edited by holders of `roles.manage` in room
  settings, under 140's hierarchy: a mapping can only target roles below the editor's own position, and never Owner.
- Applied when a Discord member joins through the Activity, the chat bridge or "Join with Discord" in a linked room (the bot
  reads the member's guild roles over REST, no privileged members intent) and re-read every 10 minutes while they are
  present; mapped roles are assignments like any other, shown with a "from Discord" mark, and a moderator's manual
  change wins until the mapping's source role changes.

### 6. The roster from Discord

- Bridged chat participants appear in 140's roster with `source: discord_chat` while they have posted in the last 10
  minutes, and count toward capacity (140), and the bridge stops relaying new people when the room is full, saying so in the channel.

## Privacy

Only the Discord id, display name and avatar URL are stored (140's member rows and `discord_party_links`); bridged lines
are room chat with 140's 7-day retention; unlinking a channel stops relaying at once and deletes
the webhook.

## Acceptance criteria

- [ ] With the switches off (the default) the bridge is not started, no route accepts a bridge credential, and
      `make smoke-offline` passes unchanged.
- [ ] A fake Activity client and a web member in one room stay in sync on play, pause and seek (140's socket).
- [ ] Chat both ways against the fake gateway: a Discord message appears in the room with the Discord badge and author;
      an app line appears through the webhook with the author's name; a room removal deletes the Discord copy and a
      Discord deletion removes the room line.
- [ ] A Discord member banned or chat-muted in the room (by their Discord id) is not relayed, from the bridge, the
      Activity or the web alike.
- [ ] The embed updates within 15 s of a join, a track change and a close, with names only as `toRosterPreview` allows.
- [ ] Scheduling, rescheduling and closing a linked room create, update and cancel the Scheduled Event.
- [ ] A role mapping assigns its party role on join and respects 140's hierarchy; a mapping to a role above the editor is
      `WATCH_PARTY_ROLE_ESCALATION`.
- [ ] Only the bridge credential can assert a Discord principal, and only for a linked room; a forged assertion is 401.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:architecture` green, with output in the PR.

## Delivery

One stack, `feat/142-discord-party-bridge`, two slices: (a) the bridge deployable, linking, bot-relayed identity and the
chat bridge; (b) the live embed, Scheduled Events and role mapping.

## Out of scope

- Rich Presence "Ask to join": join requests belong to Discord's native game SDKs, not to a web app or an Activity; 78's
  Activity presence shows the party size and Discord's own join.
- Relaying Discord voice to or from the party (dropped, see Decided).

## Testing plan

- A fake Discord Gateway and REST server in `packages/server/testing` driving the bridge, with recorded payload fixtures.
- Identity: the bridge credential boundary as a table over endpoints.

## Open questions

None.

- Decided: no voice relay. Discord members talk in Discord through 78's Activity voice channel and app members in 141's
  voice; no bot joins Discord voice. Discord documents voice receive as unsupported, a relaying bot sits inside DAVE's
  end-to-end encryption and ends it at the bridge, and relaying everyone's voice out of a channel needs consent handling
  from every person in it.
- Decided: people joining from Discord need no Taitube account; the bridge relays their identity as `discord:<id>`
  members, with roles, bans, mutes and budgets on that key, and only id, name and avatar stored.
- Decided: one bridge deployable on the Gateway, separate from 78's HTTP interactions, Node only.
- Decided: the embed is a bot-owned channel message edited at most every 15 s, not an interaction reply.
- Decided: role mapping re-reads guild roles on join and every 10 minutes, without the privileged members intent.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PRs.
- [ ] `docs/SDD.md` (the bridge deployable, the credential boundary, §6.1), `ARCHITECTURE.md`, `docs/LOCAL_FIRST.md`
      (the `discord` profile, off by default), `README.md`, `.env.example` and a runbook for the bridge updated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
