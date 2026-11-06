# 140: Watch parties - rooms on a shared clock, lobby, chat, shared queue, invites, discovery and the Discord hand-off

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Issue | TBD |
| Size | XL |
| Blocked by | 17 - Housekeeping · 30 - Transactional outbox · 41 - Channel subscriptions · 47 - Multi-resource search engine · 57 - Production video player · 59 - Modern video watch page · 63 - TanStack Start SSR and SEO · 66 - Code splitting and lazy loading · 69 - URL-driven state · 73 - Playlists and the player queue · 76 - Live streaming · 81 - CASL permissions · 95 - Design system 2 · 97 - Account preferences API · 98 - Realtime user event stream · 99 - Notifications · 105 - Clips · 106 - Channel and user themes · 108 - ABAC SQL pushdown |
| Blocks | 78 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §6.2 Error codes](../SDD.md#62-error-codes-stable-machine-readable) · [SDD §10 Real-time status](../SDD.md#10-real-time-status-sse) · [SDD §10.4 Notifications](../SDD.md#104-notifications) · [SDD §10.6 Live chat](../SDD.md#106-live-chat) · [SDD ADR-27 Realtime transport](../SDD.md#adr-27--realtime-transport-one-user-stream-over-sse) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) · [SDD §11 Security](../SDD.md#11-security) · [SDD §13.1 Metrics](../SDD.md#131-metrics-catalogue) · [SDD §14.2 Load scenarios](../SDD.md#142-scenarios) · [SDD P9 Local-first](../SDD.md#13-design-principles-used-to-break-ties-throughout) |

**Status:** blocked

> **Why.** Watching together is the one social act the platform cannot do. A viewer who wants a friend to see a
> video sends a link and they watch apart; there is no shared play button, no "pause, I missed that", no chat beside
> the video, no way to put five videos in a row for an evening. [78](78-discord-integration-bot-watch-together-activity-creator-alerts.md)
> sketched a "Watch Together" room inside Discord only, with its own Redis state. This ticket builds the room engine
> once, for the web app first, and makes 78's Discord activity one more client of it.

> **Builds on, does not redo.** The socket mechanics are 76's live chat (`apps/server/api/src/routes/live-chat.ts`,
> `live-chat-service.ts`, `live-chat-hub.ts`, `socket-keepalive.ts`, `send-socket-result.ts`, the one-time ticket in
> `RedisLiveChatGateAdapter`); the bell, the outbox producers and grouping are [99](99-notifications.md)'s; the user
> stream and the SSE hub are [98](98-realtime-user-event-stream.md)'s; the player is reached only through
> [57](57-production-video-player-hls-streaming-controls.md)'s port (`apps/client/web/src/features/player/player-port.ts`);
> queue rendering, keyboard reorder and sparse positions are [73](73-frontend-youtube-playlists-library-player-queue.md)'s
> (`apps/client/web/src/components/watch/queue/`, `packages/universal/domain/src/playlist-position.ts`); text search is
> [47](47-multi-resource-search-engine.md)'s; the accent scope is [106](106-channel-branded-and-user-built-themes.md)'s
> `BrandScope`; per-viewer settings are [97](97-account-preferences-api.md)'s sections. Nothing here forks one of them.

## Vocabulary

- **Room** (a watch party): a named place with settings, a shared queue, a chat and one playback state. Code and
  tables say `watch_party`; the UI says "watch party" or "party".
- **Phase**: `lobby` (gathering, nothing plays), `playing`, `paused`, `finished` (the queue ran out). A lobby is a
  room's first phase, not a separate thing.
- **Host** (exactly one), **co-host** (up to 10), **member** (joined), **present** (holds an open room socket now).
- **Controller**: whoever the room's control policy lets drive playback.
- **Invite**: a per-recipient grant sent to an account through the bell. **Invite link**: a bearer token in a URL,
  for anyone holding it.
- **Room clock**: the server's playback state `{ itemId, phase, positionMs, rate, anchorAt, version }`; every
  client derives where it should be from it.

## Product decisions

| Question | Decision |
|---|---|
| How is a party started? | One action, "Watch together", on the watch page, the player, the queue, a playlist, a clip and a card menu. It creates the room on the spot and opens a dialog whose first focus is the copy button, so link-in-clipboard is two clicks. Every other setting is optional and editable later. |
| Lobby or straight into playback? | Every room opens in `lobby`; the host presses Start (with a 3 s countdown everyone sees), or a scheduled room starts itself. A quick party's host lands in the lobby with Start focused, so starting costs one more click and nobody misses the first seconds. Discovery's `status=lobby` is where rooms that are gathering are found and joined, so the in-app lobby space is a filter of the one directory, not a second one. |
| Visibility | `public` (listed in discovery, joinable by anyone signed in), `unlisted` (anyone with the link), `private` (members, invitees and invite-link holders only; the bare URL answers not found to everyone else). |
| Password | Optional on any visibility. A per-recipient invite and an invite link skip it: the host's explicit grant is the stronger credential, and it is revocable. |
| Capacity | Optional, default unlimited, which means up to the operator ceiling `WATCH_PARTY_MAX_MEMBERS` (200). Section 2 has the rules. |
| Who drives playback | Room setting: `host`, `hosts` (host and co-hosts) or `everyone`. Others send a request the controllers can accept. |
| Live broadcasts in a room | Not in this ticket. A `LIVE` video cannot be queued; a live stream is already shared in real time with its own chat, and syncing LL-HLS edges is the player's live-edge job. "Live watch parties and premieres" is a follow-up. |
| Private videos | Never shareable in a room. Unlisted videos only in unlisted and private rooms; public rooms queue public videos only, so discovery never surfaces an unlisted video. |
| Signed-out visitors | See the room preview (name, host, current video, count, avatars) and "Sign in to join". Open question 1. |
| Voice or camera | No. Discord covers voice (section 11), and 76 rejected an SFU for local-first. |
| Per-room theme | The host picks an **accent** only, applied through `BrandScope`; the viewer's theme, mode, contrast and own accent always win (design README [section 2](../design/README.md#2-themes-and-token-sets)). |
| Discord | 140 builds nothing that calls Discord. Party links unfurl through Open Graph tags; 78's activity, bot and Rich Presence are clients of these rooms (section 11). |

## Where the code lives

| What | Where |
|---|---|
| Domain types, constants, the clock and drift maths, capacity | new `packages/universal/domain/src/watch-party.ts`, `watch-party-clock.ts`, `watch-party-drift.ts`, `watch-party-capacity.ts` (universal: the web client runs the same clock and drift code the server tests) |
| Validation | new `packages/universal/validation/src/watch-party.ts` (name, password, settings, schedule); the chat line validator is 76's `validateLiveChatMessage`, renamed `validateChatMessage` for both callers |
| Decisions | new `packages/universal/domain-rules/src/watch-party/` (`decide-join.ts`, `decide-control.ts`, `decide-queue-edit.ts`, `decide-chat-post.ts`, `decide-moderate.ts`, `decide-shareable.ts`) returning `Result` |
| Permissions | new `packages/universal/permissions/src/types/watch-party.ts`, `rules/watch-party.rules.ts`, `helpers/watch-parties.ts`, `normalizers/watch-party.normalizer.ts`, each with its spec |
| Errors | `packages/universal/errors/src/api-error-codes.ts`, `retry-class.ts` and a new `watch-party-failures.ts` |
| Contracts | new `packages/universal/api-contracts/src/watch-parties.ts` (REST), `watch-party-socket.ts` (frames), `watch-party-discovery.ts` (list and its SSE frames) |
| Ports | new `packages/server/core/ports/watch-party-gate.ts`, `watch-party-presence.ts`, `password-hasher.ts`; repository interfaces `packages/server/core/repositories/watch-party-*.ts` |
| Tables | new `packages/server/db/src/watch-parties-schema.ts`, one migration in `packages/server/db/drizzle/` at the next free number |
| Adapters | one file per repository in `packages/server/adapters/postgres/repositories/` and `in-memory/repositories/`; `redis/redis-watch-party-gate.adapter.ts`, `redis/redis-watch-party-presence.adapter.ts`; `scrypt-password-hasher.ts` in a new `packages/server/adapters/crypto/`; the list scope in `postgres/scopes/` |
| Channels and keys | `packages/server/events/src/channels.ts`, `keys.ts` |
| Config | `packages/server/env-schema/src/app-env.ts` (two keys), `tuning.ts` (`WATCH_PARTY`), new `watch-party-config.ts`; `.env.example` |
| API | routes `apps/server/api/src/routes/watch-parties.ts`, `watch-party-socket.ts`, `watch-party-invites.ts`, `watch-party-discovery.ts`; services under `apps/server/api/src/services/watch-party/`; `composition/watch-party.module.ts` |
| Jobs | `packages/server/job-contracts/src/notifications.ts` (two jobs); worker `apps/server/worker/src/stages/notifications/notify-party-invite.ts`, `notify-party-reminder.ts`; `stages/housekeeping/watch-party-sweep.ts` |
| Client data | new `packages/client/queries/src/watch-party-queries.ts`, `use-watch-party-socket.ts`, `watch-party-state.ts` |
| Web | routes `apps/client/web/src/routes/parties.index.tsx`, `parties.$roomId.tsx`; kit `apps/client/web/src/components/party/`; feature `apps/client/web/src/features/watch-party/` |
| Copy | new `packages/universal/messages/src/en/party.ts` and `pl/party.ts` |
| Design | new `docs/design/screens/web/party.html`, `parties.html`, `docs/design/apps/web/party-room.md`, `party-card.md`, `member-list.md`, `reaction-overlay.md` |
| Load | new `tests/load/s8-watch-parties.js` |

## What to build

### 1. The model

**Tables** (Drizzle in `watch-parties-schema.ts`, one migration):

| Table | Columns | Notes |
|---|---|---|
| `watch_party_rooms` | `id` uuidv7, `host_user_id`, `host_channel_id` (nullable, creator-hosted), `name`, `visibility` (`public` / `unlisted` / `private`), `password_hash` (nullable), `capacity` (nullable int, `CHECK (capacity >= 2)`), `control_policy` (`host` / `hosts` / `everyone`), `queue_policy` (`hosts` / `everyone`), `invite_policy` (`hosts` / `everyone`), `chat_enabled`, `slow_mode_seconds` (0, 5, 10, 30, 60), `buffer_policy` (`wait` / `continue`), `autoplay`, `skip_vote_percent` (default 50), `idle_close` (`15m` / `1h` / `24h` / `never`), `language` (BCP 47 primary subtag, nullable), `accent` (`#rrggbb`, nullable), `scheduled_for`, `auto_start`, `phase`, `playback` (jsonb, the room clock), `playback_version` (bigint), `queue_length`, `current_video_id`, `present_count`, `trend_score`, `search_text`, `search_vector` (generated, `simple` config, weights as 47), `status` (`open` / `closed`), `closed_reason`, `hidden_at`, `version` (settings), `created_at`, `updated_at`, `started_at`, `last_present_at`, `closed_at` | indexes: the list keysets per sort over open listed rows (partial), GIN on `search_vector`, trigram on `search_text`, `(host_user_id) WHERE status = 'open'` |
| `watch_party_members` | `room_id`, `user_id`, `role` (`host` / `cohost` / `member`), `joined_via` (`link` / `password` / `invite` / `invite_link` / `discovery` / `host`), `joined_at`, `left_at`, `muted_until` | PK `(room_id, user_id)`; one `host` row per room (partial unique) |
| `watch_party_bans` | `room_id`, `user_id`, `banned_by`, `reason`, `created_at` | PK `(room_id, user_id)`; for the room's life |
| `watch_party_invites` | `id`, `room_id`, `inviter_id`, `invitee_id`, `status` (`pending` / `joined` / `declined` / `revoked`), `expires_at`, `created_at` | unique `(room_id, invitee_id)` |
| `watch_party_invite_links` | `id`, `room_id`, `created_by`, `token_hash` (SHA-256), `expires_at`, `max_uses`, `uses`, `revoked_at`, `created_at` | the token itself is shown once |
| `watch_party_queue_items` | `id`, `room_id`, `video_id`, `added_by`, `position` (sparse, `playlist-position.ts`), `start_ms`, `played_at`, `removed_at`, `created_at` | |
| `watch_party_messages` | `id` uuidv7, `room_id`, `user_id` (null for system lines), `kind` (`text` / `system`), `body`, `system` (jsonb), `video_id`, `position_ms`, `pinned`, `removed_at`, `created_at` | `video_id` and `position_ms` are where the room was, so "Party history and replay" can replay chat later without a migration |
| `watch_party_interest` | `room_id`, `user_id`, `created_at` | "Interested" on a scheduled room |
| `watch_party_reports` | `id`, `room_id`, `reporter_id`, `reason` (`spam` / `abuse` / `sexual` / `violence` / `other`), `details`, `created_at`, `resolved_at` | unique `(room_id, reporter_id)` |
| `notifications` | adds `watch_party_id` (FK, `ON DELETE CASCADE`) | |

**The room clock** (`watch-party-clock.ts`): `playback` is `{ itemId, phase, positionMs, rate, anchorAt }`, and the `phase`
column is its indexed copy, written in the same statement. The expected position at server time `t` is `positionMs + (t -
anchorAt) * rate` while `playing`, else `positionMs`. Every change is a
compare-and-set on `playback_version`: a command carries the version it saw and a stale one is refused with the current
state. The version is the fencing token, so a command from a pod that lagged or a client that missed a frame can never
overwrite a newer state. Moderation and role changes write their system line in the same transaction. No row per seek:
the room's history is not a product feature and a write per scrub is amplification for nothing.

**Settings** are optimistic on `version` (`PATCH` sends it, `VERSION_CONFLICT` otherwise), like video edits.

**Lifecycle**: `open` until the host closes it, a moderator closes it, or the sweep closes it for idleness
(`idle_close` after `last_present_at`; a scheduled room is exempt until an hour past `scheduled_for`). A room keeps its
row 30 days after closing (invites and notifications point at it) and its messages 7 days.

**Limits**: `WATCH_PARTY_MAX_OPEN_PER_USER` (3) open rooms a user hosts; a fourth create is `WATCH_PARTY_LIMIT_REACHED`.
`idle_close = never` makes a persistent named room ("Friday movie night") that stays until closed by hand.

### 2. Joining: access, passwords, invites and capacity

`decideWatchPartyJoin` (pure, `@vp/domain-rules`) decides in this order, each a typed failure:

1. Closed -> `WATCH_PARTY_CLOSED` (410).
2. Banned from this room -> `WATCH_PARTY_BANNED` (403).
3. Access: a member already, a valid per-recipient invite for the caller, or a valid invite link -> granted, password
   skipped. Otherwise a `private` room -> `WATCH_PARTY_NOT_FOUND` (404, no existence leak); a password set and none sent
   -> `WATCH_PARTY_PASSWORD_REQUIRED` (403, not 401, so the client's session refresh never fires on it); a wrong one -> `WATCH_PARTY_PASSWORD_INVALID` (403).
4. Capacity -> `WATCH_PARTY_FULL` (409, with `present` and `capacity`).

**Passwords**: 4 to 64 characters. Hashed with scrypt through `node:crypto` (`N = 2^15`, `r = 8`, `p = 1`, 16-byte salt,
32-byte key, encoded `scrypt$N$r$p$salt$hash`), async so it runs on the thread pool, compared with `timingSafeEqual`.
Behind `PasswordHasherPort`; one class serves both adapter families with the cost from config (cheap in specs). Not
argon2: the repo has no hasher today, `argon2` is a native addon outside the dual-runtime image story, and `Bun.password`
is a `Bun.*` API rule 2 forbids; `node:crypto` scrypt runs under Node and Bun. **Attempts**: the gate's budget is checked
before hashing, 5 failures per 15 minutes per account and per IP per room, then `WATCH_PARTY_PASSWORD_LOCKED` (429,
`Retry-After`); a success clears the account's count. Changing the password keeps current members and every live grant.

**Invite links**: `POST .../invite-links` with `ttl` (`1h`, `24h` default, `7d`) and optional `maxUses`; 32 random bytes,
base64url, stored as SHA-256, shown once. The URL is `/parties/<id>?invite=<token>`; the page swaps it for the bare URL
after joining, so it does not stay in history or a copied address bar. Revoking or expiring a link stops new joins and
never removes members.

**Capacity** (`watch-party-capacity.ts`):

- `capacity` is optional; `null` means up to the operator ceiling `WATCH_PARTY_MAX_MEMBERS` (default 200). The host sets 2
  to the ceiling when creating or editing. 200 is chosen because a room is one Redis channel and every pod holding one of
  its sockets writes every broadcast to each: at the chat burst budget (5 lines per 10 s per member) 200 members is a
  worst case of 100 lines per second fanned to 200 sockets, which S8 (section 15) holds on one API pod with headroom,
  and above it a room would need sharded fan-out this ticket does not build.
- It counts **present** people: open sockets, admitted atomically in Redis (`WatchPartyPresencePort.admit`, a Lua script
  that prunes stale entries, admits a member already present, and otherwise admits only below the limit), so two pods
  cannot both admit the last spot. The REST join pre-checks the same count for a fast answer; the socket upgrade decides.
- The host and co-hosts **count** toward the number shown ("12 / 12") but are **never refused**: a host can always get back
  into their own room. That reserve is bounded (10 co-hosts), so the ceiling holds within 11.
- **Lowering** the limit below the current count kicks nobody; the room shows "13 / 10", and joins are refused until
  present drops below the new limit.
- **Invites do not bypass it**: a per-recipient invite and an invite link skip the password, never the limit.
- What a joiner sees when full: on the room page, a "This party is full (10 of 10)" panel with the current video and the
  member avatars, a "Watch on your own" link to the video, and the count re-read every 10 s while the tab is visible; when
  a spot opens, Join enables and a polite announcement says so. From an invite, the notification row opens the same panel
  and stays actionable (the invite is not used up). From discovery, the `space=true` filter leaves full rooms out; without
  it a full card shows a "Full" badge and its button opens the same panel.

### 3. The room socket and the sync protocol

**Transport, decided: one WebSocket per member per room**, `GET /v1/watch-parties/:id/socket?ticket=&after=`, carrying
sync, chat, reactions, presence and requests.

- Not 98's user stream: it is one-way, per user and log-backed with up to a second of outbox relay latency, and a room
  member sends often (commands, clock pings, chat, reactions, ready and buffering flags). ADR-27 already names a room as
  the case for a socket.
- Not a second socket for chat: one ticket, one connection, one ordering, so the "now playing" system line and the state
  change arrive in the order they happened.
- The mechanics are 76's: a one-time ticket from `POST .../socket-ticket` through the app's `/api` proxy, `Origin` checked
  against `CORS_ORIGINS` before the upgrade, a refusal answered as an HTTP Problem before upgrading, `keepAlive` pings and
  the buffered-bytes cut-off, `sendSocketResult` for an `error` frame on an open socket. The pattern-subscribing hub is
  extracted from `LiveChatHub` into one generic `apps/server/api/src/services/pattern-hub.ts` used by both, not copied.
- **Fan-out across API replicas** (HPA 2 to 10, no sticky sessions): every change is published on `watch-party:{roomId}`
  through `CacheClient.publish`; each pod holds one pattern subscription `watch-party:*` and writes to the sockets it holds.
  The in-memory `CacheClient` does the same, so a spec runs two Fastify apps over one cache to prove cross-pod delivery.
- **One socket per member per room**: a second one (another tab or device) supersedes the first, which gets `superseded`
  and closes. That also stops one account holding several spots.

**Order on connect**: redeem the ticket, check membership, ban and phase, admit to presence (capacity), join the hub, read
the chat backlog after `?after=`, write `hello` (room, the caller's role and mute, the room clock with `serverNow`, the
queue, present members, chat mode, pinned line), the backlog, then what arrived meanwhile, each once (76's ordering).

**The clock on the client** (`watch-party-clock.ts`, shared): the client sends `clock { t0 }` on connect and every 30 s,
the server answers `clock { t0, serverNow }`, and the client keeps the offset of the lowest round-trip of its last 8
samples (NTP's minimum filter). The server's time is the pod's wall clock: pods are NTP-synced and their skew is far under
the 250 ms threshold below, and `watch_party_clock_skew_seconds` (each pod against Postgres `clock_timestamp()`, sampled
by the poller every minute) alerts if that stops being true.

**Commands** (controllers only, `decideWatchPartyControl`): `play`, `pause { positionMs }`, `seek { positionMs }`,
`rate { rate }` (0.5, 0.75, 1, 1.25, 1.5, 2), `next`, `start` (lobby -> playing after a 3 s countdown: the anchor is
`now + 3000`), each with the `version` it saw. The pod applies it as one CAS and publishes `state { playback, version, by,
reason }`; the sender gets `ack`. A stale version gets an `error` frame `WATCH_PARTY_STATE_STALE` with the current state,
and the client re-applies on top. Commands are budgeted 6 per 5 s per member across pods (the gate), so a stuck key
cannot flood the room.

**Drift correction** (`watch-party-drift.ts`, constants `WATCH_PARTY_DRIFT`): once a second the client compares its
`currentTime` with the expected position.

| Drift | Action |
|---|---|
| under 250 ms | nothing |
| 250 ms to 2 s | nudge `playbackRate` by 5 % toward the room (room rate times 0.95 or 1.05) until within 100 ms, then back to the room rate |
| over 2 s | hard seek to the expected position plus the measured seek latency, then no correction for 3 s |

250 ms because two people talking over a call notice a gap of about a third of a second; 2 s because a 5 % nudge
closes 2 s in 40 s, past which a seek is less noticeable than a long speed change. Every 30 s the client reports its
absolute drift and hard seeks in a `stats` frame; the server records them (section 14).

**Late joiners**: `hello` carries the state; the player loads the item, seeks to the expected position at load time and
plays. Browsers refuse unmuted autoplay without a recent gesture: when `play()` is refused the client plays muted and shows
a "Tap for sound" chip, and never blocks sync on it.

**Reconnect**: the client fetches a new ticket (tickets are one-time) and reconnects with backoff (1 s to 30 s, as
`use-live-chat.ts`), resuming chat with `?after=`; the state needs no replay because `hello` is a full snapshot. While
disconnected the player keeps playing on the last known clock, and a "Reconnecting" badge shows on the stage.

**Buffering**: members send `buffering { true | false }`. With `buffer_policy = wait` and at most 12 present members, a
member buffering for more than 1.5 s makes the server pause the room with `reason: buffering` (the system as actor); it
resumes when nobody is buffering or after 10 s, and a member still buffering then is left to catch up through drift
correction, marked "Catching up". Above 12 members, or with `continue`, the room never waits: one bad connection must not
stall a large room. The player port gains `buffering` and `ended` in `PlayerState`, implemented by the Video.js engine.

**Host leaving**: a host whose socket closes keeps the role for a 60 s grace (a reload or a network blip). After it, the
role passes to the longest-present co-host, else the longest-present member, as one CAS on the host membership, with a
`host` broadcast and a system line. The pod that saw the close schedules the check; the sweep (section 1) catches it if
that pod died. A host can transfer explicitly at any time. A room with nobody present closes per `idle_close`.

**Queue end**: `ended` from any present client is accepted when the expected position is within 2 s of the item's
duration; with `autoplay` the room advances to the next item by CAS, otherwise it pauses at the end. After the last item
the phase becomes `finished`, and adding an item offers Start again.

**Mid-party changes**: a member's player still reads each video through `GET /v1/videos/:id` (`decideVideoRead`), so a
room never grants playback rights. The platform has no age gate today; when one lands it holds through that same
per-member read, and a member who loses access sees "Not available to you" while the room plays on. The sweep and every advance re-check `decideWatchPartyShareable` on the current and
queued items: a video that turned private, was deleted or stopped being shareable for the room's visibility is removed
from the queue with a system line ("This video is no longer available"), and the room skips to the next item within a
minute. Ads: the platform serves none, so there is nothing to sync.

### 4. Room chat, reactions and requests

- **Chat** reuses 76's pieces, not its table: `validateChatMessage` (1 to 200 characters, one line), the gate's burst
  (5 lines per 10 s per member across pods), slow mode, the resume cursor (200 lines, `fresh` / `replayed` / `expired`),
  and the kit `LiveChat` (`apps/client/web/src/components/live/live-chat/`) under a `PartyChat` smart wrapper. Lines go to
  `watch_party_messages`, **stored before they are published** (76's rule). `live_chat_messages` is keyed by a live
  stream with a broadcast offset, which a room has neither of.
- **System lines** (joined, left, now playing, host changed, settings changed, removed by a moderator) are stored rows, so
  a reconnect shows them; each viewer can hide them (section 8).
- **Timestamps** typed as `12:34` render as a chip; a controller's click seeks the room, anyone else's sends a request.
- **Pinned line**: hosts pin one line, shown above the list.
- **Moderation** (host and co-hosts, and platform moderators): remove a line, mute a member (10 min, 1 h, rest of the
  party), kick (may rejoin), ban (for the room's life), slow mode, chat off. Each is a system line and a log line.
- **Reactions**: a fixed palette of 8 emoji (in the catalogue, not free text). `react { emoji }` is budgeted 10 per 5 s
  per member; each pod folds reactions per room over 250 ms into one `reactions { counts, from }` frame, so 200 people
  reacting at once is a few frames per second, not 200 times 200. Not stored.
- **Requests**: someone who cannot control sends `request { kind: seek | skip | control, positionMs? }`; controllers see
  it as an actionable toast ("Ana asks to jump to 12:34", Accept or Dismiss). `control` asks the host to make them a
  co-host. Budgeted 3 per minute per member.

### 5. The shared queue and playlist autoplay

- Server-side `watch_party_queue_items`, ordered with 73's sparse positions (`appendPosition`, the midpoint move,
  `renumberPositions`), at most 200 items.
- **Sources at create**: a video (optionally `startMs`, from the watch page's playhead or a clip's start), a playlist
  (its items the host can read and the room may share, copied once: a later edit to the playlist does not surprise the
  room; collaborative live-linked playlists are [119](119-playlists-customisation-and-collaboration.md)'s), or the local
  player queue (73's `PlaybackSession` videos in order, starting at the current one).
- **Who edits**: `queue_policy = hosts` lets controllers add, reorder and remove; `everyone` also lets members add, with at
  most 3 pending items each, and remove their own. Edits go through REST (`POST`, `PATCH`, `DELETE` on `.../queue`), so
  78's bot and a card menu can add without a socket; every edit broadcasts `queue { items, version }`.
- **Vote to skip**: `skipVote { itemId }` over the socket; the room skips when votes reach `skip_vote_percent` of present
  members (rounded up). Votes reset per item; `votes { itemId, votes, needed }` shows the tally.
- **Autoplay** advances on end (section 3); shuffle is an action that reorders the remaining items, not a mode.
- The UI renders 73's `Queue` kit (side, below and sheet layouts, keyboard reorder with announcements) under a
  `PartyQueue` wrapper, plus who added each item.

### 6. Invites and notifications

- **Kinds**: `party_invite` and `party_starting` join `NOTIFICATION_KINDS` in `@vp/domain`, switched by a new
  `watchParties` flag in the `notifications` preferences section (account scope, default on). The payload gains `party:
  { roomId, name, videoTitle, scheduledFor, inviteId, expiresAt } | null`; `actor` is the inviter's channel.
- **Producers**, through the outbox in the transaction of their cause (SDD §10.4): `WatchPartyInviteRepository.create`
  writes `notify-party-invite`; scheduling writes `notify-party-reminder` (section 10). The job id names the cause
  (`<inviteId>--notify-party-invite`).
- **Grouping**: `party_invite:<roomId>` folds several people inviting the viewer to the same room ("Ana and 2 others
  invited you to Movie night"); `party_starting:<roomId>`.
- **Expiry**: an invite expires at the later of 24 h after sending and 6 h after `scheduled_for`, and when the room
  closes. The row stays in the bell; its CTA turns into "Ended" once `expiresAt` passes, and a click still opens the room
  page, which says the party ended.
- **The row** (99's `NotificationRow` in `features/notifications/components/`): the **whole row is the join link**
  (`/parties/<id>?invite=<inviteId>`, the per-recipient grant), with a visual "Join" pill inside it as its call to action
  (not a nested button; the link's accessible name ends in "Join"). Decline is a sibling icon button after the link, a new
  `NotificationCentre.ItemAction` kit part (44 px target, inline-end); it calls `POST /v1/me/watch-party-invites/:id/decline`
  and marks the notification read. An invite arriving live shows a toast with Join, as 99 does for replies.
- **The host's view**: pending and joined invites, with revoke; a decline shows as nothing (it stays "pending" to the host
  until it expires), so declining carries no social cost.
- **Inviting**: an "Invite people" picker in the share dialog and the People tab, backed by
  `GET /v1/watch-parties/:id/invite-candidates?q=`: people from parties the viewer was in during the last 30 days, owners
  of channels the viewer subscribes to, and a handle or name prefix match (47's channel suggestions), each with
  `inRoom` and `invited` flags. Up to 20 per request, 30 per hour per user, 50 pending per room; re-inviting the same
  person inside the group window folds. Who may invite at all is the room's `invite_policy`.
- **Link copy and QR**: the share dialog copies the room URL, or an invite link (24 h) when the room is private or has a
  password ("Link skips the password", on by default), shows a QR code (`qrcode`, SVG, in the dialog's lazy chunk; no
  network) and uses the Web Share API where the browser has it, which reaches the Discord app on a phone.

### 7. Entry points

All open the same `WatchTogetherDialog` (`features/watch-party/components/`, through `lazyComponent`), which creates the
room on open (`source` from where it was opened; a host's unstarted room for the same source from the last hour that
nobody joined is reused rather than duplicated) with the link field, Copy (first focus), QR, Share, Invite people, and a
"Room settings" disclosure (name, visibility, password, capacity, control, queue and invite policy, start-at toggle "Start
at 12:34", host as channel, schedule, accent), then "Go to party".

| Where | Action |
|---|---|
| Watch page engagement bar (`watch-engagement-bar.tsx`) | "Watch together" beside Share, starting at the playhead when it is past 0 (toggle, like the share dialog's) |
| Player control bar (`features/player/components/control-bar.tsx`) | a "Watch together" button, working in fullscreen (the dialog portals into the fullscreen element) |
| Queue (`features/watch/components/watch-queue.tsx`) | "Watch together" in the queue header: the whole queue from the current video |
| Playlist page (`features/library/components/playlist-hero.tsx`) | "Watch together" beside Play all |
| Clip page (`features/clips/components/clip-page.tsx`) | "Watch together" from the clip's start |
| Video card menu | "Watch together", and "Add to party queue" while the viewer is in an open party |
| Command palette | "Start a watch party", "Join a party from a link" |

Signed out, each action opens sign-in, as `ClipAction` does.

### 8. The party page

`/parties/$roomId` (`routes/parties.$roomId.tsx`). SSR loads the preview (`GET /v1/watch-parties/:id`) for public and
unlisted rooms, for the head and the first paint; the socket is client-only.

**Layout** (compound `PartyRoom` in `components/party/party-room/`: `Root`, `Stage`, `Header`, `Panel`, `Tabs`, `Overlay`):

- **Expanded and large**: the stage (player, ambient glow) with the room header above (name, host, phase, count, Invite,
  Settings for hosts, Layout menu) and a 360 px panel at inline-end with tabs Chat, People, Queue. Reactions bar under the
  stage.
- **Theater**: stage full width, the panel below it. **Focus**: panels hidden, chat as the live overlay (76's, with its
  opacity slider). Fullscreen uses the overlay too.
- **Medium**: stage full width, panel below.
- **Compact**: player sticky at the top at 16:9, then a `SegmentedControl` for Chat, People, Queue; the composer pinned
  above the keyboard (`dvh` units); reactions as a strip above the composer; landscape goes fullscreen with the overlay;
  host controls in a sheet.
- **Lobby**: the stage shows the first item's poster with "Waiting for <host> to start", or the scheduled countdown;
  members as an avatar grid with ready ticks; the host's Start and Ready check ("4 of 6 ready"); chat and queue as in the
  party.
- **Member list** (`components/party/member-list/`): avatar, name, role badge, and a sync state per present member (In
  sync, Catching up, Buffering, Away), then members who are not present. A host's menu per member: make co-host,
  transfer host, mute, kick, ban.
- **On the stage**: a sync badge (In sync, Catching up, Reconnecting), "Ana paused" style notices in a polite live region,
  the countdown, request toasts for controllers, and the reaction overlay (`components/party/reaction-overlay/`):
  emoji rise and fade on the motion tokens; under reduced motion they become static count chips.
- **Who controls**: a viewer without control sees play, pause and seek disabled with "Only the host controls playback"
  and a Request button; keyboard (`k` or Space, `j` and `l`, `c` to chat, `r` for reactions, Escape) follows the same
  rule.
- **Customization, per viewer**: the Layout menu sets layout (`side`, `below`, `theater`, `focus`), chat overlay in
  fullscreen, reaction overlay on or off, and system lines on or off. Saved in a new 97 section `party` (scope `both`,
  so a device can differ from the account), applied with no layout shift on load because SSR reads the cookie copy as 97
  does for appearance.
- **Room accent**: the host picks a swatch or a custom `#rrggbb` (`ACCENT_PATTERN`), or "Channel colour" for a
  creator-hosted room; the page wraps in `BrandScope`, which never touches `live`, `danger` or status roles and yields to
  the viewer's own accent.
- **States** (design README [section 8, States](../design/README.md#states)), each with a story: loading (the exact
  layout as a skeleton), signed-out preview, password, full, banned, not found, closed ("This party ended", with its
  last video), kicked, reconnecting, offline (the player keeps going on the last clock; chat read-only), partial (chat
  failed to connect while sync works, and the reverse), empty queue, lobby, finished.
- **Head**: `noindex, nofollow` always (rooms are ephemeral). Public and unlisted rooms get Open Graph and Twitter tags
  through `features/seo/page-head.ts` (title "<name> - watch party", the video's thumbnail, "Watching <title> with N
  people"); a private room gets the generic "Join a watch party on Taitube" with no name or image. That is what Discord,
  Slack and messengers unfurl.

**Design**: no screen exists for parties or rooms (`docs/design/screens/web/` has none). Slice 2 adds
`docs/design/screens/web/party.html` (lobby, party in side, theater and focus layouts, compact portrait and landscape,
fullscreen overlay, the join panel states, the share dialog with QR, the invite picker), the component docs
`party-room.md`, `member-list.md`, `reaction-overlay.md`, a `party` icon in `packages/client/ui/src/icons/inventory.tsx`,
the invite row in `docs/design/apps/web/notification-centre.md`, and the wrapper rows in [the wrapper
table](../design/apps/web/README.md#smart-wrappers), before the components are built. Every surface meets the polish bar
([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).

### 9. Discovery: `/parties`

**Route and nav**: `routes/parties.index.tsx`. The rail's main group gains "Watch parties" after Live (the `party` icon,
`compact: false`), in `features/shell/shell-destinations.tsx`; the command palette gets "Browse watch parties"; compact
placement is open question 4.

**Filters, all in the URL**, typed by a zod `validateSearch` with the `preprocess` fallback `routes/search.tsx` uses (a bad
value falls back to its default, never an error page), so any filtered view is a shareable link:

| Param | Values | Meaning |
|---|---|---|
| `q` | text, `validateSearchQuery` (47) | room name, host handle or name, current video title |
| `status` | `all` (default), `now`, `lobby`, `scheduled` | playing or paused; gathering; `scheduled_for` in the future |
| `category` | category id | the current video's category |
| `language` | a primary subtag from the supported list | the room's language, which the host sets (default the host's locale) |
| `access` | `any` (default), `open`, `password` | |
| `size` | `any` (default), `small` (up to 10 present), `medium` (11 to 50), `large` (over 50) | |
| `space` | `true` | present below the room's effective capacity |
| `followed` | `true`, signed in only | the host's channel, or a present member's channel, is one the viewer subscribes to |
| `creator` | `true` | hosted as a channel (`host_channel_id` set) |
| `kind` | `any` (default), `single`, `playlist` | `queue_length` 1, or more than 1 |
| `sort` | `members` (default), `newest`, `starting_soon`, `trending` | |

**API**: `GET /v1/watch-parties` with those params plus `cursor` and `limit` (1 to 48, default 24), answering `{ items:
WatchPartyCard[], nextCursor }`. Keyset per sort with the repo's `Paginator` and `Base64UrlCursorCodec`: `members` on
`(present_count desc, id)`, `newest` on `(created_at desc, id)`, `starting_soon` on `(scheduled_for, id)` (implies
`status=scheduled`), `trending` on `(trend_score desc, id)`; the cursor carries its sort and is refused under another
(`INVALID_CURSOR`). Counts move between pages, so a members-sorted walk can repeat a room; the client drops repeats by
id. `trend_score` is written by the sweep each minute as `(joins in the last 30 min + present_count) / (age in hours + 2)
^ 1.2`, so the sort is an index walk, not a computation per request.

**Search**: 47's engine on Postgres, not a new index: `search_text` (room name, host handle and display name, current
video title, rewritten when any of them changes) feeds a generated `simple` tsvector with 47's weights and
`websearch_to_tsquery`, with the `pg_trgm` `word_similarity` fallback when words match nothing, through 47's text-match
helpers (`postgres/repositories/search-query.ts`). Rooms do not join `GET /v1/search`: they live for hours and a search
result that 404s an hour later is worse than none.

**What is listed** (`watchPartyListScope` in `postgres/scopes/`, 108's pushdown): open, `public`, not hidden, not
auto-hidden by reports, the current item public (or no item yet), and not a room the viewer is banned from. Password rooms
are listed with a lock.

**Cards** (`components/party/party-card/`, `PartyCard` wrapper): the current video's thumbnail with a progress bar that
moves locally from the card's clock snapshot (no push per second), room name, host avatar and name (the channel badge
when creator-hosted), a phase pill (Now playing, Lobby, Starts 20:00), "12 watching" with up to 5 present avatars, "12 /
20" when capped, the lock, the language, "Playlist, 8 videos", and Join.

**Live updates**: `GET /v1/watch-parties/events`, an anonymous SSE stream on 98's `SseHub` with a new channel type
`parties`: `party.counts` (batched every 2 s), `party.opened` (a card), `party.updated` (name, current video, phase) and
`party.closed` (id). The page opens it only while visible and online; counts patch the cards in the infinite query cache,
a closed card turns "Ended" in place (no reflow; it drops on the next refetch), and new rooms matching the filters (the
card carries every filter field, so the client matches) raise a "3 new parties" pill over the grid that refetches on
click. Anonymous streams are capped at 4 per IP.

**States**: loading (the grid's skeleton), empty with no rooms ("No parties right now" and Start a party), empty with
filters ("Nothing matches these filters" and Clear filters), error with retry, offline (the cached page and a banner),
partial (live updates down: a quiet "Live updates paused", the page still works).

**Design**: slice 3 adds `docs/design/screens/web/parties.html` (the grid at every breakpoint, the filter sheet on
compact, each state) and `docs/design/apps/web/party-card.md` before the page is built.

**Abuse and moderation**: 60 list requests a minute per caller; the first page of each filter set cached 5 s for signed-out
callers (`followed` is per viewer, never cached). `POST .../reports` (one per reporter per room); 3 open reports from
distinct accounts hide a room from discovery until a moderator restores it; `POST /v1/admin/watch-parties/:id/close`
and `.../restore` for MODERATOR and ADMIN. Names are 1 to 60 characters, no URLs, no control characters.

**SEO**: `/parties` is indexable with its own head (title, description, `index, follow`); every filtered variant's
canonical is `/parties`, so filter combinations never become thousands of thin pages. Party pages are `noindex` and not
in the sitemap (section 8).

### 10. Scheduled parties

- `scheduledFor` at create or edit, 5 minutes to 30 days ahead. The room is in `lobby` from creation; people can join
  early. "Interested" (`PUT` and `DELETE /v1/watch-parties/:id/interest`) for anyone who can see the room.
- **Reminders**: `notify-party-reminder` is enqueued through the outbox as two delayed jobs, 10 minutes before and at the
  start, for the interested and the pending invitees (`party_starting`). The job id carries the scheduled instant, so a
  reschedule enqueues new ones and a job whose instant no longer matches the row does nothing; closing sends nothing.
- **Start**: with `auto_start` (default on for scheduled rooms) the room starts itself at `scheduled_for` if anyone is
  present; otherwise the host starts it. From 15 minutes past, co-hosts may start it; an hour past with no start it
  closes as "didn't start".

### 11. Discord: what is 140's and what is 78's

140 builds the room engine and keeps it client-agnostic: anything with a session can create a room, join, hold the
socket and edit the queue. It adds **no Discord code, no `DISCORD_*` key and no call to Discord**; party links unfurl in
Discord through the Open Graph tags (section 8), and the share dialog's Web Share reaches the Discord app on phones.
`make smoke-offline` is unaffected.

[78](78-discord-integration-bot-watch-together-activity-creator-alerts.md) (edited in this PR to match) owns the rest,
all behind its Discord config and off by default: its Watch Together activity joins the 140 room mapped to the activity
instance (a `discord_activity_rooms` table, 78's) and renders 140's party page in a compact layout, holding no room
state of its own; its bot gains `/party` (create a room as the linked user and post the link) and "Watch together"
buttons on its embeds; Rich Presence inside the activity shows the party size from 140's presence and a Join button.
78 is blocked by 140, so there is one room design.

### 12. Permissions

`@vp/permissions` gains the `WatchParty` subject, normalized per viewer (`toWatchPartySubject(room, membership)`: `hostId`,
`coHostIds`, the policies, the viewer's role). The grants a link or password give are not abilities and stay in
`decideWatchPartyJoin`.

| Action | Host | Co-host | Member | Signed-in non-member | MODERATOR, ADMIN | Signed out |
|---|---|---|---|---|---|---|
| `read` (preview) | yes | yes | yes | public and unlisted; private with a grant | yes | public and unlisted |
| `join` | yes | yes | - | through section 2 | through section 2 | no |
| `control` | yes | `hosts`, `everyone` | `everyone` | no | no | no |
| `editQueue` | yes | yes | `everyone` (adds; removes own) | no | no | no |
| `invite` | yes | yes | `invite_policy = everyone` | no | no | no |
| `moderate` (remove line, mute, kick, ban) | yes | yes, not the host | no | no | yes | no |
| `update` (settings), `manageRoles`, `transferHost` | yes | no | no | no | no | no |
| `close` | yes | no | no | no | yes | no |
| `report` | no | no | yes | yes (public rooms) | yes | no |

Helpers `canControlWatchParty` and the rest feed `<Can>` in the web app; the server never hand-checks a role.
`apps/client/web/e2e/security/privilege-escalation.test.ts` gains rows, each 403 for a signed-in non-host and 401 signed
out: edit another host's room, close it, change a member's role, kick, ban, transfer the host, create and list invite
links, remove another member's queue item under `queue_policy = hosts`, and the admin close as a normal user. Reading
someone else's private room is 404 and asserted in the API spec, since the table's statuses are 403 and 401.

### 13. Contracts

Everything in `@vp/api-contracts` and the committed OpenAPI document (`pnpm gen:contracts`), with SDD §6.1 rows and an
`apps/server/api/src/__tests__/sdd-watch-party-endpoints.ts` for the SDD contract check. New error codes, each with its
`PROBLEM_STATUS` and `RETRY_CLASS`: `WATCH_PARTY_NOT_FOUND` (404), `WATCH_PARTY_CLOSED` (410), `WATCH_PARTY_FULL` (409),
`WATCH_PARTY_BANNED` (403), `WATCH_PARTY_PASSWORD_REQUIRED` (403), `WATCH_PARTY_PASSWORD_INVALID` (403),
`WATCH_PARTY_PASSWORD_LOCKED` (429), `WATCH_PARTY_INVITE_INVALID` (403), `WATCH_PARTY_LIMIT_REACHED` (409),
`WATCH_PARTY_VIDEO_NOT_SHAREABLE` (422), `WATCH_PARTY_QUEUE_FULL` (409), `WATCH_PARTY_STATE_STALE` (409, socket only),
`WATCH_PARTY_NOT_CONTROLLER` (403), `WATCH_PARTY_MUTED` (403), `WATCH_PARTY_SLOW_MODE` (429), `WATCH_PARTY_CHAT_OFF` (403),
`WATCH_PARTY_TICKET_INVALID` (401).

| Method and path | Purpose | Request | Response | Notes |
|---|---|---|---|---|
| `POST /v1/watch-parties` | Create a room | `{ name?, visibility, password?, capacity?, controlPolicy?, queuePolicy?, invitePolicy?, chatEnabled?, slowModeSeconds?, bufferPolicy?, autoplay?, skipVotePercent?, idleClose?, language?, accent?, scheduledFor?, autoStart?, hostAs: 'user' \| 'channel', source?: { videoId, startMs? } \| { playlistId } \| { videoIds, startIndex? }, reuse? }` | `201 WatchParty` / `400` / `401` / `409 WATCH_PARTY_LIMIT_REACHED` / `422 WATCH_PARTY_VIDEO_NOT_SHAREABLE` / `429 RATE_LIMITED` | 10 per hour per user. `hostAs: 'channel'` needs a channel with a public ready video. |
| `GET /v1/watch-parties/:id` | Room preview | - | `200 WatchParty & { viewer: { role, canJoin } }` / `404` | Anonymous for public and unlisted. `canJoin` is `member`, `yes`, `password`, `full`, `banned` or `closed`. |
| `PATCH /v1/watch-parties/:id` | Edit settings | settings above plus `version`; `password: null` clears it | `200 WatchParty` / `403` / `404` / `409 VERSION_CONFLICT` / `422` | Host. A changed setting is broadcast as `settings`. |
| `POST /v1/watch-parties/:id/close` | Close | `{ reason? }` | `200` / `403` / `404` | Host. Sockets get `closed` and close. |
| `POST /v1/watch-parties/:id/join` | Join | `{ password?, invite? }` (invite id or link token) | `200 { membership }` / `403` (password required or invalid, banned, invalid invite) / `404` / `409 WATCH_PARTY_FULL` / `410` / `429 WATCH_PARTY_PASSWORD_LOCKED` | Idempotent for a member. |
| `POST /v1/watch-parties/:id/leave` | Leave | - | `204` | |
| `POST /v1/watch-parties/:id/socket-ticket` | Socket ticket | - | `201 { ticket, expiresAt }` / `403` / `404` | Members only, 30 s, one-time. |
| `GET /v1/watch-parties/:id/socket?ticket=&after=` (WebSocket) | Room socket | client frames below | `101` then server frames / `401 WATCH_PARTY_TICKET_INVALID` / `403` / `404` / `409 WATCH_PARTY_FULL` | Refusals are Problems before the upgrade; hidden from the OpenAPI document like 76's. |
| `GET /v1/watch-parties/:id/members?cursor=` | Members | - | `200 { items: [{ user, role, present, syncState, joinedAt }], nextCursor }` | Members only. |
| `PUT /v1/watch-parties/:id/members/:userId/role` | Make co-host or member | `{ role: 'cohost' \| 'member' }` | `200` / `403` / `404` / `409` (10 co-hosts) | Host. |
| `PUT /v1/watch-parties/:id/members/:userId/mute` | Mute | `{ until: '10m' \| '1h' \| 'party' \| null }` | `200` / `403` | `moderate`. |
| `POST /v1/watch-parties/:id/members/:userId/kick` | Kick | - | `204` / `403` | `moderate`; the socket gets `kicked`. |
| `PUT` and `DELETE /v1/watch-parties/:id/bans/:userId` | Ban, unban | `{ reason? }` | `204` / `403` | `moderate`. |
| `POST /v1/watch-parties/:id/host` | Transfer host | `{ userId }` | `200` / `403` / `404` | Host; the target must be a member. |
| `GET /v1/watch-parties/:id/queue` | Queue | - | `200 { items, version }` | Members. |
| `POST /v1/watch-parties/:id/queue` | Add | `{ videoId, startMs? } \| { playlistId }` | `201` / `403` / `409 WATCH_PARTY_QUEUE_FULL` / `422 WATCH_PARTY_VIDEO_NOT_SHAREABLE` | `editQueue`. |
| `PATCH /v1/watch-parties/:id/queue/:itemId` | Move | `{ toIndex }` | `200` / `403` | |
| `DELETE /v1/watch-parties/:id/queue/:itemId` | Remove | - | `204` / `403` | |
| `POST /v1/watch-parties/:id/invites` | Invite | `{ userIds }` (1 to 20) | `201 { sent, folded, refused: [{ userId, reason }] }` / `403` / `429` | `invite`; `refused` covers the invitee's switch and banned users without saying which. |
| `GET /v1/watch-parties/:id/invites` | Pending and joined invites | - | `200 { items }` | Host and co-hosts. |
| `DELETE /v1/watch-parties/:id/invites/:inviteId` | Revoke | - | `204` | |
| `POST /v1/me/watch-party-invites/:inviteId/decline` | Decline | - | `204` / `404` | The invitee; marks its notification read. |
| `POST /v1/watch-parties/:id/invite-links` | Invite link | `{ ttl, maxUses? }` | `201 { id, token, url, expiresAt }` | `invite`; the token is shown once. |
| `GET /v1/watch-parties/:id/invite-links` | Links | - | `200 { items }` (no tokens) | |
| `DELETE /v1/watch-parties/:id/invite-links/:linkId` | Revoke a link | - | `204` | |
| `GET /v1/watch-parties/:id/invite-candidates?q=` | People to invite | - | `200 { items: [{ userId, handle, displayName, avatarUrl, reason, inRoom, invited }] }` | `invite`. |
| `GET /v1/watch-parties?…` | Discovery | section 9 | `200 { items: WatchPartyCard[], nextCursor }` / `400 INVALID_CURSOR` / `429` | Anonymous. |
| `GET /v1/watch-parties/events` | Discovery stream (SSE) | - | `party.counts`, `party.opened`, `party.updated`, `party.closed` | Anonymous, 4 per IP. |
| `GET /v1/me/watch-parties` | My rooms | - | `200 { hosting, joined, interested }` | Open rooms only. |
| `PUT` and `DELETE /v1/watch-parties/:id/interest` | Interested | - | `204` | Scheduled rooms. |
| `POST /v1/watch-parties/:id/reports` | Report | `{ reason, details? }` | `201` / `409` (already reported) | |
| `POST /v1/admin/watch-parties/:id/close` and `.../restore` | Moderate | `{ reason }` | `200` / `403` | MODERATOR, ADMIN. |

**Socket frames** (`watch-party-socket.ts`, one discriminated union each way, every client frame with an optional `ref`):

| Client sends | Server sends |
|---|---|
| `clock { t0 }` | `hello { room, you: { role, mutedUntil }, playback, version, serverNow, queue, present, chat: { resume, mode, pinned } }` |
| `play`, `pause`, `seek`, `rate`, `next`, `start` (each `{ version, … }`) | `clock { t0, serverNow }` |
| `ended { itemId, version }` | `state { playback, version, by, reason }` |
| `ready { ready }`, `buffering { buffering }` | `countdown { startsAt }` |
| `skipVote { itemId }` | `queue { items, version }`, `votes { itemId, votes, needed }` |
| `request { kind, positionMs? }` | `request { from, kind, positionMs? }` (controllers only) |
| `chat.send { message }`, `chat.remove { id }`, `chat.pin { id \| null }` | `chat.message`, `chat.removed`, `chat.pinned`, `chat.mode` |
| `react { emoji }` | `reactions { counts, from }` |
| `stats { driftMs, hardSeeks }` | `presence { joined \| left \| updated }`, `member { userId, role }`, `host { userId }`, `settings { … }` |
| | `ack { ref }`, `error { ref, problem }`, `kicked`, `closed { reason }`, `superseded` |

### 14. Observability

| Metric | Type | Labels | Source |
|---|---|---|---|
| `watch_party_rooms` | gauge | `phase` | API poller (SQL) |
| `watch_party_present_members` | gauge | - | API poller (SQL, `present_count` sum) |
| `watch_party_sockets` | gauge | - | API, per pod |
| `watch_party_joins_total` | counter | `outcome` (joined, full, password_required, password_invalid, locked, banned, closed, not_found) | API |
| `watch_party_commands_total` | counter | `command`, `result` (applied, stale, refused) | API |
| `watch_party_drift_seconds` | histogram | - | API, from `stats` frames (absolute drift; buckets 0.05 to 5 s) |
| `watch_party_hard_seeks_total` | counter | - | API, from `stats` frames |
| `watch_party_fanout_seconds` | histogram | - | API: publish time in the broadcast to the write on each pod |
| `watch_party_chat_messages_total` | counter | `outcome` (sent, refused) | API |
| `watch_party_invites_total` | counter | `outcome` (sent, folded, refused) | API |
| `watch_party_clock_skew_seconds` | gauge | - | API poller (pod clock minus Postgres `clock_timestamp()`) |

- **Traces**: `watch_party.join` and `watch_party.command` spans (room id, command, result, version) around the CAS and
  the publish; REST routes are covered by the existing instrumentation.
- **Logs**: one line per create, close, host transfer and moderation action with room and actor ids; refused joins
  count in the metric, not one log line each. The pino redaction paths gain `password`, `invite`, `token` and `ticket`.
- **Dashboard** `infra/observability/dashboards/watch-parties.json` (rooms, present, sockets per pod, joins by outcome,
  drift p50 and p95, fan-out p95, commands by result, chat rate, skew), copied into the k8s dashboards config map.
- **Alerts** in `infra/observability/alerts/video-pipeline-alerts.yaml`, each with a runbook under `docs/runbooks/`:
  `WatchPartyDriftHigh` (drift p95 over 1 s for 10 min, warning), `WatchPartyFanoutSlow` (fan-out p95 over 250 ms for
  10 min, warning), `WatchPartyPasswordBruteForce` (password failures over 1 per second for 5 min, warning),
  `WatchPartyClockSkew` (absolute skew over 100 ms for 5 min, warning).

### 15. Load and abuse

- **S8 `tests/load/s8-watch-parties.js`** (k6 `k6/websockets`): 200 rooms of 25 members (5 000 sockets) over 2 API
  replicas, plus one room at the ceiling (200 members). Each member pings the clock every 30 s, chats about every 30 s and
  reacts in bursts; one controller per room sends a command every 20 s. Pass: command to every member's `state` p95
  under 250 ms, fan-out p95 under 150 ms, socket errors under 0.1 %, API RSS under 768 MB per pod, no `superseded` or
  `kicked` frames that the script did not cause. A row in SDD §14.2 and results under `docs/load-tests/results/`.
- **Abuse, as specs**: the 6th wrong password in 15 minutes is `WATCH_PARTY_PASSWORD_LOCKED` with `Retry-After`, for an
  account and for an IP across accounts; the 31st invite in an hour is `RATE_LIMITED`; the 6th chat line in 10 s and a
  line inside slow mode are refused with the retry time; the 7th command in 5 s is refused; the 11th room created in an
  hour and the 4th open room are refused; the 61st discovery request in a minute is `429`; a 5th anonymous discovery
  stream from one IP is refused; a second socket for the same member supersedes the first; frames over 4 KB and
  unknown frame types are `error` frames, never a crash.

### And beyond: what is in this ticket, and what is a follow-up

| Idea | Where |
|---|---|
| Lobby with ready check and a 3 s start countdown | this ticket |
| Reaction overlay with synced emoji | this ticket |
| Start at a timestamp; a party from a clip | this ticket |
| Scheduled parties with "Interested" and reminders | this ticket |
| Co-hosts, requests to seek, skip or control, vote to skip | this ticket |
| Pinned chat line, timestamp chips in chat, system lines | this ticket |
| Per-member sync state in the member list | this ticket |
| Host accent, per-viewer layout saved through 97 | this ticket |
| QR code, Web Share, invite links with expiry and uses | this ticket |
| Persistent named rooms (`idle_close = never`) | this ticket |
| Reports with auto-hide and a moderator close | this ticket |
| Live broadcasts in a room, and creator premieres (a scheduled first showing announced to subscribers, set up in the studio) | follow-up "Live watch parties and premieres" |
| Past parties, chat replayed against the video (`position_ms` is stored now), a reaction heatmap | follow-up "Party history and replay" |
| Keep the party going in the now playing bar while browsing, and picture-in-picture | follow-up "Party in the now playing bar" |
| Signed-out spectators or guest join | follow-up "Party spectators and guests", if open question 1 goes that way |
| A people graph (follow a person, friends) for invites and the `followed` filter | follow-up "People you follow" |
| Invites to a closed browser | follow-up "Web Push", after 99's push work |
| Polls, predictions and trivia in a room | follow-up "Party polls and games" |
| A phone as the remote for a TV tab | follow-up "Second-screen remote" |
| A reported-rooms queue in the admin panel ([61](61-admin-control-panel-category-moderation-ui.md)) | follow-up "Party moderation queue" |
| Rooms in global search | follow-up, once rooms prove long-lived enough to be worth a result |
| Voice and camera | out: Discord covers voice, and an SFU breaks local-first (76) |

## Delivery

One stack, `feat/140-watch-parties`, three slices (`slice/140a-…` to `slice/140c-…`), each green on its own:

1. **140a: Rooms engine.** Tables and migration, domain, validation, decisions, permissions, error codes, ports and both
   adapter families (gate, presence, hasher, repositories), the `pattern-hub.ts` extraction under `LiveChatHub`, every
   REST endpoint of section 13 except discovery, the room socket with the clock, commands, drift reporting, buffering,
   host grace, chat, reactions, requests and votes, the notification kinds and the invite job, the sweep, the env keys
   and tuning, the backend metrics and logs, SDD (§5, §6.1, §6.2, §10.4, a new §10.7 Watch parties, §16, ADR-27's line,
   ADR-31), ARCHITECTURE and CONTEXT.
2. **140b: The party page and every way in.** Design screens and component docs first, then the kit (`PartyRoom`,
   `MemberList`, `ReactionOverlay`, `NotificationCentre.ItemAction`, the `party` icon), the player port's `buffering` and
   `ended`, the client socket, clock and drift driver in `@vp/queries`, the party page in every phase and state, the
   per-viewer `party` preferences section, the room accent, the share dialog with QR and Web Share, the invite picker,
   the entry points of section 7, the invite row and toast in the bell, the party page head, copy in `en` and `pl`, and
   the two-browser e2e.
3. **140c: Discovery, schedules and the hand-off.** The discovery design screen and `PartyCard`, the discovery endpoint, scope, search and SSE stream, the `/parties`
   page with its filters, cards, states and nav entry, scheduled parties with interest and reminders, reports and the
   moderator close, the dashboard, alerts and runbooks, S8 and its results, the 78 hand-off check, and the ticket set to
   `done`.

## Acceptance criteria

### 140a: Rooms engine

- [ ] Two members on two API instances sharing one cache: a `pause` from one reaches the other as `state` with the new
      version, and a command carrying an old version gets `WATCH_PARTY_STATE_STALE` with the current state.
- [ ] The clock spec: expected position for playing, paused and rate changes; the offset filter picks the lowest
      round-trip of 8 samples; the drift table (ignore, nudge, seek with cooldown) as one `it.each`.
- [ ] A control command from a member is `WATCH_PARTY_NOT_CONTROLLER` under `host` and `hosts` and applied under
      `everyone`; a co-host's applies under `hosts`.
- [ ] Host grace: the host's socket closing keeps the role for 60 s, a reconnect inside it keeps it, and after it the
      longest-present co-host (else member) becomes host with a `host` frame and a system line; with the transferring
      pod killed, the sweep transfers within a minute.
- [ ] Buffering: with `wait` and 12 or fewer present, a member buffering 1.5 s pauses the room with `reason: buffering`
      and it resumes when nobody buffers or after 10 s; with 13 present, or `continue`, it never pauses.
- [ ] Capacity, each case a spec:
  - [ ] no capacity set: joins are admitted up to `WATCH_PARTY_MAX_MEMBERS` and the next is `WATCH_PARTY_FULL`;
  - [ ] capacity 10 with 10 present: an 11th member is refused, an invitee is refused, an invite-link holder is refused,
        and the host and a co-host reconnecting are admitted;
  - [ ] lowering capacity from 12 to 10 with 12 present kicks nobody, refuses the next join, and admits again once
        present is 9;
  - [ ] two pods admitting the last spot at once admit exactly one (the Redis script, under the contract suite);
  - [ ] the ceiling comes from `WATCH_PARTY_MAX_MEMBERS` in `env-schema`, mirrored in `.env.example` (default 200), and a
        capacity above it is `VALIDATION_FAILED`.
- [ ] Passwords: a wrong one is `WATCH_PARTY_PASSWORD_INVALID`; the 6th failure in 15 minutes is
      `WATCH_PARTY_PASSWORD_LOCKED` with `Retry-After`, per account and per IP; a valid invite or invite link joins
      without it; the stored value is an `scrypt$` string and the hasher spec passes under `pnpm test:bun`.
- [ ] A private room is 404 to a non-member without a grant; a revoked or expired invite link joins nobody and removes no
      member; a banned user is refused with every grant.
- [ ] A queued video that turns private is removed with a system line and the room skips within a minute; a private
      video is `WATCH_PARTY_VIDEO_NOT_SHAREABLE` everywhere, and an unlisted one is refused in a public room only.
- [ ] Queue: add, move and remove under each policy; the 4th pending add by a member under `everyone` is refused; skip
      votes reaching the threshold advance; `ended` near the end advances with `autoplay` and is ignored 10 s early.
- [ ] Chat: a line is stored before it is published and a reconnect with `?after=` replays exactly what was missed;
      mute, slow mode, chat off, remove and pin behave as section 4; reactions from 200 members inside 250 ms reach each
      socket as at most one `reactions` frame per pod.
- [ ] An invite creates one `party_invite` notification through the outbox (none on rollback), folds a second inviter
      into the same row, respects the `watchParties` switch, and emits 98's `notification.created`.
- [ ] `privilege-escalation.test.ts` gains the section 12 rows, all green; the permission table is one `it.each` in
      `helpers/__tests__/watch-parties.test.ts`.
- [ ] Rooms close per `idle_close`, `never` stays open, and messages and rows are purged at 7 and 30 days.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm boundaries`,
      `pnpm gen:contracts` (no diff) green, with output in the PR.

### 140b: The party page and every way in

- [ ] From the watch page, "Watch together" then Copy puts a working room link on the clipboard in two clicks, and the
      same works from the player (also in fullscreen), the queue, a playlist, a clip and a card menu; signed out, each
      opens sign-in.
- [ ] Two browsers in one room (Playwright, two contexts): the host's play, pause, seek and rate reach the other within
      500 ms, and the follower's measured drift settles under 250 ms within 10 s of a seek.
- [ ] A late joiner starts at the room's position; a refused unmuted autoplay plays muted with "Tap for sound".
- [ ] The lobby shows ready ticks and the host's Start runs a countdown both browsers see before playback starts.
- [ ] The invite row: clicking anywhere on it joins the room (skipping the password); Decline removes the CTA, marks it
      read and notifies nobody; an expired invite shows "Ended".
- [ ] The full panel shows on the room page and from an invite (which stays actionable), and enables Join when a spot
      opens.
- [ ] Layout changes (side, below, theater, focus, overlays, system lines) persist through 97 and load with no layout
      shift (CLS under 0.05).
- [ ] A host's accent recolours the room's accent roles only, and a viewer with their own accent keeps theirs.
- [ ] A public room's page carries Open Graph tags with its name and thumbnail, a private room's carries none of either,
      and every party page is `noindex`.
- [ ] Every party surface has every state of section 8 as a story, and meets the polish bar
      ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) including compact portrait and landscape.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @vp/web test`, `pnpm test:architecture` green, with
      output in the PR.

### 140c: Discovery, schedules and the hand-off

- [ ] `/parties` is in the rail after Live and in the command palette, and its filters round-trip through the URL: a
      copied filtered URL opens the same view, and a bad value falls back to its default.
- [ ] Each filter, one row of a table spec over seeded rooms: `q` (by room name, by host handle, by current video title,
      and a typo through the trigram fallback), `status` (`now`, `lobby`, `scheduled`), `category`, `language`, `access`
      (`open`, `password`), `size` (`small`, `medium`, `large`), `space`, `followed` (and ignored signed out), `creator`,
      `kind` (`single`, `playlist`).
- [ ] Each sort walks its keyset to the end with no gap, a cursor from another sort is `INVALID_CURSOR`, and the client
      drops a repeated id.
- [ ] `space=true` leaves full rooms out; without it a full card shows "Full" and opens the full panel.
- [ ] Private, unlisted, closed, hidden, 3-times-reported and banned-from rooms, and rooms playing a non-public video,
      never appear.
- [ ] With the page open, a join elsewhere updates the card's count within 3 s, a closed room turns "Ended" in place, and
      a new matching room raises the "new parties" pill with no layout shift.
- [ ] Empty, empty-with-filters, loading, error, offline and partial states exist with stories.
- [ ] `/parties` is indexable with canonical `/parties` on every filtered variant.
- [ ] A scheduled room: "Interested" users and pending invitees get `party_starting` 10 minutes before and at the start,
      a reschedule sends only the new reminders, and `auto_start` starts it with someone present.
- [ ] S8 meets its thresholds on 2 API replicas, with the results in `docs/load-tests/results/`.
- [ ] The dashboard renders in the compose Grafana, and each alert fires on a synthetic series in its rule spec.
- [ ] 78 lists 140 in Blocked by and its section 3 names no room state of its own.
- [ ] `make smoke-offline` passes; `local-first-check` finds no new host.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts` (no
      diff) green, with output in the PR.

## Out of scope

- Live broadcasts in a room, premieres, party history, the now playing bar, spectators, a people graph, Web Push, polls,
  a second-screen remote, the admin queue UI and global search: each is a named follow-up above.
- Voice and camera.
- Platform-wide user blocking (none exists); channel bans from [113](113-channel-comment-moderation.md) applying to a
  creator-hosted room belong to 113 or a follow-up once it lands.
- Anything that calls Discord (78).
- Studio changes: party members' views and watch history count as each member's own playback, unchanged.

## Testing plan

- **Pure**: the clock, drift, capacity and every `decide*` as `it.each` tables in `@vp/domain` and `@vp/domain-rules`,
  under vitest and `bun test`.
- **Ports**: contract suites for `WatchPartyGatePort` and `WatchPartyPresencePort` over the in-memory and Redis adapters
  (the atomic admit under concurrency), `PasswordHasherPort` over scrypt.
- **Repositories**: each Postgres repository against PGlite (CAS on `playback_version`, the list scope, the keysets,
  search with the fallback), each with its in-memory twin.
- **API**: routes through the in-memory app; the socket with two app instances over one cache for fan-out, host grace with
  fake timers, buffering, supersede, every refusal before the upgrade.
- **Worker**: the invite and reminder jobs (rollback, folding, the stale reminder) and the sweep.
- **Web**: component specs through the suite's single render helper; the socket hook against a fake socket; the drift
  driver against a fake `PlayerCommands`; route specs for `/parties` search params.
- **E2E**: two browser contexts for sync, the invite flow from the bell, the password and full panels, discovery live
  updates; `privilege-escalation.test.ts`.
- **Load**: S8.

## Open questions

1. **Signed-out visitors.** (a) Preview and "Sign in to join"; (b) read-only spectating of public and unlisted rooms
   (synced video and chat, no sending, counted toward capacity); (c) a guest join with a nickname. Recommended (a): an
   anonymous socket is a new abuse surface and capacity loophole, and Discord users arrive signed in through 78 anyway;
   (b) can follow if the funnel shows people bouncing at sign-in.
2. **Who may invite you.** A `watchPartyInvites` choice in notification settings with (a) everyone, (b) people whose
   channel you subscribe to, (c) nobody. Recommended default (a), with the per-user and per-room limits above: there is no
   friend graph, so (b) would block most friends, and a decline costs one click.
3. **Quick party defaults** (from "Watch together"): visibility `unlisted`, control `everyone`, queue `everyone`, chat on,
   no capacity, no password, `idle_close` 15 minutes; a room created from `/parties` defaults to `public` and control
   `hosts`. Recommended as listed: a party started from a video is usually friends, where anyone pausing is the point; a
   public room needs a driver.
4. **Discovery on compact**, where the tab bar is full: (a) a "Watch parties" row in the You hub (`/feed/you`) and the
   command palette; (b) replace Trending in the tab bar; (c) a Parties chip on `/live`. Recommended (a), until usage says
   it earns a tab.

- Decided: one WebSocket per member per room for sync, chat, reactions and requests, not 98's stream (one way, per user,
  a second of relay latency) and not two sockets (two tickets, no shared ordering).
- Decided: the room clock lives in Postgres with a version CAS, fanned out through Redis; Redis holds only short-lived
  state (tickets, presence, budgets, votes). A pod dying loses no room state.
- Decided: pod wall clocks are the time source, with a skew metric and alert rather than a clock service.
- Decided: drift thresholds 250 ms and 2 s, a 5 % rate nudge between them and a hard seek above.
- Decided: buffering waits only in rooms of 12 or fewer, at most 10 s.
- Decided: scrypt through `node:crypto` behind `PasswordHasherPort`, not argon2.
- Decided: per-recipient invites and invite links skip the password and never the capacity.
- Decided: capacity counts present sockets; host and co-hosts count but are never refused; lowering it kicks nobody; the
  ceiling is `WATCH_PARTY_MAX_MEMBERS`, default 200.
- Decided: the chat reuses 76's validator, gate, hub, resume and kit, with its own table.
- Decided: queue edits are REST and broadcast on the socket; playlists are copied into the queue, not linked.
- Decided: no live broadcasts and no private videos in rooms; unlisted videos only in non-public rooms.
- Decided: discovery search is 47's Postgres engine over a room `search_text`; rooms stay out of `GET /v1/search`.
- Decided: discovery live updates are SSE (one way, anonymous) on 98's hub.
- Decided: the host sets an accent only, through `BrandScope`.
- Decided: `qrcode` for the QR code, rendered to SVG in the browser.
- Decided: 140 contains no Discord code; 78 maps activity instances to rooms in its own table.
- Decided: SDD gains ADR-31, "Watch parties: a server-authoritative room clock on one socket", recording the transport,
  the CAS clock, the fan-out and the capacity ceiling.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PRs.
- [ ] `docs/SDD.md`: §5 (the tables), §6.1 (every endpoint above), §6.2 (the codes), §9.8 (the sweep), §10.4 (the two
      kinds and group keys), a new §10.7 Watch parties (socket order, clock, drift, fan-out, capacity), ADR-27's
      WebSocket line naming 140 instead of 78, the new ADR-31, §13.1 metrics, §13.5 alerts, §14.2 S8, §16 the two env
      keys.
- [ ] `ARCHITECTURE.md` §3 lists `WatchPartyGatePort`, `WatchPartyPresencePort` and `PasswordHasherPort`; `CONTEXT.md`
      gains the vocabulary above; `README.md` lists watch parties; `.env.example` carries `WATCH_PARTY_MAX_MEMBERS` and
      `WATCH_PARTY_MAX_OPEN_PER_USER`.
- [ ] The design screens, component docs and wrapper rows of section 8 are in `docs/design/`.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
