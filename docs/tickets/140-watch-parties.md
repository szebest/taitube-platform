# 140: Watch parties - rooms on a shared clock, room roles, guests, the roster, lobby, chat, shared queue, invites, discovery and the Discord hand-off

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Issue | TBD |
| Size | XL |
| Blocked by | 17 - Housekeeping · 30 - Transactional outbox · 41 - Channel subscriptions · 47 - Multi-resource search engine · 57 - Production video player · 59 - Modern video watch page · 63 - TanStack Start SSR and SEO · 66 - Code splitting and lazy loading · 69 - URL-driven state · 73 - Playlists and the player queue · 76 - Live streaming · 81 - CASL permissions · 95 - Design system 2 · 97 - Account preferences API · 98 - Realtime user event stream · 99 - Notifications · 105 - Clips · 106 - Channel and user themes · 108 - ABAC SQL pushdown |
| Blocks | 78, 141, 142, 143 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §6.2 Error codes](../SDD.md#62-error-codes-stable-machine-readable) · [SDD §10 Real-time status](../SDD.md#10-real-time-status-sse) · [SDD §10.4 Notifications](../SDD.md#104-notifications) · [SDD §10.6 Live chat](../SDD.md#106-live-chat) · [SDD ADR-27 Realtime transport](../SDD.md#adr-27--realtime-transport-one-user-stream-over-sse) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) · [SDD §11 Security](../SDD.md#11-security) · [SDD §13.1 Metrics](../SDD.md#131-metrics-catalogue) · [SDD §14.2 Load scenarios](../SDD.md#142-scenarios) · [SDD P9 Local-first](../SDD.md#13-design-principles-used-to-break-ties-throughout) |

**Status:** in-progress

> **Why.** Watching together is the one social act the platform cannot do. A viewer who wants a friend to see a
> video sends a link and they watch apart; there is no shared play button, no "pause, I missed that", no chat beside
> the video, no way to put five videos in a row for an evening. [78](78-discord-integration-bot-watch-together-activity-creator-alerts.md)
> sketched a "Watch Together" room inside Discord only, with its own Redis state. This ticket builds the room engine
> once, for the web app first, and makes 78's Discord activity one more client of it. Voice is
> [141](141-watch-party-voice-chat.md), the Discord chat bridge is [142](142-discord-party-bridge.md), and the long tail of
> fun is [143](143-watch-party-extras.md); this ticket builds what all three plug into.

> **Builds on, does not redo.** The socket mechanics are 76's live chat (`apps/server/api/src/routes/live-chat.ts`,
> `live-chat-service.ts`, `live-chat-hub.ts`, `socket-keepalive.ts`, `send-socket-result.ts`, the one-time ticket in
> `RedisLiveChatGateAdapter`); the bell, the outbox producers and grouping are [99](99-notifications.md)'s; the user
> stream and the SSE hub are [98](98-realtime-user-event-stream.md)'s; the player is reached only through
> [57](57-production-video-player-hls-streaming-controls.md)'s port (`apps/client/web/src/features/player/player-port.ts`);
> queue rendering, keyboard reorder and sparse positions are [73](73-frontend-youtube-playlists-library-player-queue.md)'s
> (`apps/client/web/src/components/watch/queue/`, `packages/universal/domain/src/playlist-position.ts`); text search is
> [47](47-multi-resource-search-engine.md)'s; abilities and `<Can>` are [81](81-casl-declarative-permissions-refactor.md)'s
> CASL model; the accent scope is [106](106-channel-branded-and-user-built-themes.md)'s `BrandScope`; per-viewer settings
> are [97](97-account-preferences-api.md)'s sections. Nothing here forks one of them.

## Vocabulary

- **Room** (a watch party): a named place with settings, roles, a shared queue, a chat and one playback state. Code and
  tables say `watch_party`; the UI says "watch party" or "party".
- **Phase**: `lobby` (gathering, nothing plays), `playing`, `paused`, `finished` (the queue ran out). A lobby is a
  room's first phase, not a separate thing.
- **Principal**: who a seat belongs to, one of three kinds: an **account** (`user:<uuid>`), a **Discord member**
  (`discord:<snowflake>`, no Taitube account, verified by 78) or a **guest** (`guest:<id>`, anonymous, party-scoped).
  Its **member key** is that string; every per-person row and budget in a room is keyed by it.
- **Room permission**: one capability inside a room (`playback.control`, `chat.post`, ...), from one closed registry.
- **Role**: a named, coloured set of room permissions with a position, either granting permissions or removing them.
  Eleven roles are built in (section 2); anyone holding `roles.manage` adds custom ones.
- **Owner** (exactly one, an account or a Discord member, never a guest), **member** (holds a seat), **present** (holds an open room socket now).
- **Effective permissions**: what a member may do now, computed from the roles they hold (section 2).
- **Roster**: the one list of who is in the party, whatever path they came by (section 3).
- **Personal controls**: what one viewer chooses to mute or hide for themselves only (section 9).
- **Invite**: a per-recipient grant sent to an account through the bell. **Invite link**: a bearer token in a URL,
  for anyone holding it.
- **Room clock**: the server's playback state `{ itemId, phase, positionMs, rate, anchorAt, version }`; every
  client derives where it should be from it.

## Product decisions

| Question | Decision |
|---|---|
| How is a party started? | One action, "Watch together", on the watch page, the player, the queue, a playlist, a clip and a card menu. It creates the room on the spot and opens a dialog whose first focus is the copy button, so link-in-clipboard is two clicks. Every other setting is optional and editable later. |
| Lobby or straight into playback? | Every room opens in `lobby`; whoever holds `playback.control` presses Start (with a 3 s countdown everyone sees), or a scheduled room starts itself. A quick party's owner lands in the lobby with Start focused, so starting costs one more click and nobody misses the first seconds. Discovery's `status=lobby` is where rooms that are gathering are found and joined, so the in-app lobby space is a filter of the one directory, not a second one. |
| Who may do what in a room | Roles, not fixed modes: the owner and anyone with `roles.manage` edit what each role may do, add custom roles and assign them. A preset only chooses Member's starting permissions (section 2). |
| Signed-out visitors | Anyone can join and watch without an account, as a **guest**: in sync, seeing chat and the roster, hearing voice when it is on, but never typing, reacting, speaking or acting. The preview offers "Watch as guest", "Join with Discord" (only when 78's Discord integration is configured) and "Sign in"; signing in or joining with Discord later upgrades the same seat in place. Per room, "Allow guests" is on by default for public and unlisted rooms and off for private ones. |
| People from Discord | Need no Taitube account: a Discord identity (78's Activity, 78's "Join with Discord" on the web, or 142's chat bridge) is a Discord member who can watch, chat, react and talk within the room's roles. Linking a Taitube account is one click and only needed for account features (owning rooms, party history, subscribing, in-app invites, saved layout). |
| Visibility | `public` (listed in discovery), `unlisted` (anyone with the link), `private` (members, invitees and invite-link holders only; the bare URL answers not found to everyone else). |
| Password | Optional on any visibility. A per-recipient invite and an invite link skip it: an explicit grant is the stronger credential, and it is revocable. |
| Capacity | Optional, default unlimited, which means up to the operator ceiling `WATCH_PARTY_MAX_MEMBERS` (200). Guests count. Section 4 has the rules. |
| Live broadcasts in a room | Not in this ticket. A `LIVE` video cannot be queued; a live stream is already shared in real time with its own chat, and syncing LL-HLS edges is the player's live-edge job. It moves to 143 with premieres. |
| Private videos | Never shareable in a room. Unlisted videos only in unlisted and private rooms; public rooms queue public videos only, so discovery never surfaces an unlisted video. |
| Who may invite you | Everyone, by default, inside the rate limits of section 8; each user changes it in notification settings (`everyone`, `subscriptions`, `nobody`). |
| Voice or camera | Voice is 141, on a self-hosted SFU and off by default; 140 reserves its permissions, its two roles and its roster fields. No camera. |
| Per-room theme | The owner picks an **accent** only, applied through `BrandScope`; the viewer's theme, mode, contrast and own accent always win (design README [section 2](../design/README.md#2-themes-and-token-sets)). |
| Discord | 140 builds nothing that calls Discord. Party links unfurl through Open Graph tags; 78's activity, bot and Discord guests and 142's chat bridge are clients of these rooms (section 14). |

## Where the code lives

| What | Where |
|---|---|
| Domain types, constants, the clock and drift maths, capacity | new `packages/universal/domain/src/watch-party.ts`, `watch-party-clock.ts`, `watch-party-drift.ts`, `watch-party-capacity.ts` (universal: the web client runs the same clock and drift code the server tests) |
| Principals, the roster and its privacy projection, personal controls | new `packages/universal/domain/src/watch-party-principal.ts`, `watch-party-roster.ts`, `watch-party-personal-controls.ts` |
| The permission registry, built-in roles, presets, effective permissions | new `packages/universal/domain/src/watch-party-permissions.ts` and `watch-party-roles.ts` |
| Validation | new `packages/universal/validation/src/watch-party.ts` (name, password, settings, schedule, role name and colour); the chat line validator is 76's `validateLiveChatMessage`, renamed `validateChatMessage` for both callers |
| Decisions | new `packages/universal/domain-rules/src/watch-party/` (`decide-join.ts`, `decide-shareable.ts`, `decide-role-edit.ts`, `decide-role-assign.ts`, `decide-member-action.ts`, `decide-chat-post.ts`, `decide-seat-upgrade.ts`) returning `Result` |
| Permissions | new `packages/universal/permissions/src/types/watch-party.ts`, `rules/watch-party.rules.ts`, `helpers/watch-parties.ts`, `normalizers/watch-party.normalizer.ts`, each with its spec |
| Errors | `packages/universal/errors/src/api-error-codes.ts`, `retry-class.ts` and a new `watch-party-failures.ts` |
| Contracts | new `packages/universal/api-contracts/src/watch-parties.ts` (REST), `watch-party-roles.ts` (roles REST), `watch-party-guests.ts` (guest sessions and seat upgrades), `watch-party-socket.ts` (frames), `watch-party-discovery.ts` (list and its SSE frames); `endpoint.ts` gains the `partyGuest` flag |
| Ports | new `packages/server/core/ports/watch-party-gate.ts`, `watch-party-presence.ts`, `party-guest-sessions.ts`, `password-hasher.ts`; repository interfaces `packages/server/core/repositories/watch-party-*.ts` |
| Tables | new `packages/server/db/src/watch-parties-schema.ts`, one migration in `packages/server/db/drizzle/` at the next free number |
| Adapters | one file per repository in `packages/server/adapters/postgres/repositories/` and `in-memory/repositories/`; `redis/redis-watch-party-gate.adapter.ts`, `redis/redis-watch-party-presence.adapter.ts`, `redis/redis-party-guest-sessions.adapter.ts`; `scrypt-password-hasher.ts` in a new `packages/server/adapters/crypto/`; the list scope in `postgres/scopes/` |
| Auth | `apps/server/api/src/plugins/auth.ts` resolves a party-guest credential only on `partyGuest` routes |
| Channels and keys | `packages/server/events/src/channels.ts`, `keys.ts` |
| Config | `packages/server/env-schema/src/app-env.ts` (three keys), `tuning.ts` (`WATCH_PARTY`), new `watch-party-config.ts`; `.env.example` |
| API | routes `apps/server/api/src/routes/watch-parties.ts`, `watch-party-roles.ts`, `watch-party-guests.ts`, `watch-party-socket.ts`, `watch-party-invites.ts`, `watch-party-personal-controls.ts`, `watch-party-discovery.ts`; services under `apps/server/api/src/services/watch-party/`; `composition/watch-party.module.ts` |
| Jobs | `packages/server/job-contracts/src/notifications.ts` (two jobs); worker `apps/server/worker/src/stages/notifications/notify-party-invite.ts`, `notify-party-reminder.ts`; the sweep is in the API, `apps/server/api/src/services/watch-party/watch-party-sweep.ts` on a `Poller` |
| Client data | new `packages/client/queries/src/watch-party-queries.ts`, `use-watch-party-socket.ts`, `watch-party-state.ts`, `use-personal-controls.ts` |
| Web | routes `apps/client/web/src/routes/parties.index.tsx`, `parties.$roomId.tsx`, `settings/party-controls.tsx`; kit `apps/client/web/src/components/party/`; feature `apps/client/web/src/features/watch-party/` |
| Copy | new `packages/universal/messages/src/en/party.ts` and `pl/party.ts` |
| Design | new `docs/design/screens/web/party.html`, `parties.html`, `docs/design/apps/web/party-room.md`, `party-card.md`, `roster.md`, `reaction-overlay.md`, `role-editor.md`, `personal-controls.md` |
| Load | new `tests/load/s8-watch-parties.js` |

## What to build

### 1. The model

**Tables** (Drizzle in `watch-parties-schema.ts`, one migration):

| Table | Columns | Notes |
|---|---|---|
| `watch_party_rooms` | `id` uuidv7, `owner_key` (a member key, never a guest's), `as_channel_id` (nullable: hosted as a channel), `name`, `visibility` (`public` / `unlisted` / `private`), `password_hash` (nullable), `capacity` (nullable int, `CHECK (capacity >= 2)`), `allow_guests`, `chat_enabled`, `slow_mode_seconds` (0, 5, 10, 30, 60), `buffer_policy` (`wait` / `continue`), `autoplay`, `skip_vote_percent` (default 50), `idle_close` (`15m` / `1h` / `24h` / `never`), `language` (BCP 47 primary subtag, nullable), `accent` (`#rrggbb`, nullable), `scheduled_for`, `auto_start`, `phase`, `playback` (jsonb, the room clock), `playback_version` (bigint), `roles_version` (bigint), `permissions_version` (int, the registry version the roles were last upgraded to), `queue_length`, `current_video_id`, `present_count`, `trend_score`, `search_text`, `search_vector` (generated, `simple` config, weights as 47), `status` (`open` / `closed`), `closed_reason`, `hidden_at`, `version` (settings), `created_at`, `updated_at`, `started_at`, `last_present_at`, `closed_at` | indexes: the list keysets per sort over open listed rows (partial), GIN on `search_vector`, trigram on `search_text`, `(owner_key) WHERE status = 'open'` |
| `watch_party_members` | `room_id`, `member_key`, `kind` (`user` / `discord` / `guest`), `user_id` (FK, accounts only), `discord_user_id` (Discord members only), `display_name` and `avatar_url` (snapshots for Discord members and guests; an account's are read live), `joined_via` (`link` / `password` / `invite` / `invite_link` / `discovery` / `owner` / `activity` / `bridge`), `joined_at`, `left_at` | PK `(room_id, member_key)` |
| `watch_party_roles` | `id`, `room_id`, `key` (the built-in role's key, null for a custom role), `kind` (`grant` / `restrict`), `name`, `colour` (`#rrggbb`, nullable), `position` (int), `created_at`, `updated_at` | unique `(room_id, key)` where `key` is set, unique `(room_id, position)`; eleven built-in rows per room, written with it |
| `watch_party_role_permissions` | `role_id`, `permission` (a registry id) | PK `(role_id, permission)`; ids are checked against the registry on write, not by a `CHECK`, so adding a permission needs no migration |
| `watch_party_member_roles` | `room_id`, `member_key`, `role_id`, `granted_by`, `expires_at` (nullable), `created_at` | PK `(room_id, member_key, role_id)`; Owner, Member and Guest are never rows (section 2) |
| `watch_party_bans` | `room_id`, `member_key`, `ip_hash` (guests only), `banned_by`, `reason`, `created_at` | PK `(room_id, member_key)`; for the room's life |
| `watch_party_invites` | `id`, `room_id`, `inviter_id`, `invitee_id`, `status` (`pending` / `joined` / `declined` / `revoked`), `watching` (jsonb snapshot, section 3), `expires_at`, `created_at` | unique `(room_id, invitee_id)`; accounts only |
| `watch_party_invite_links` | `id`, `room_id`, `created_by`, `token_hash` (SHA-256), `expires_at`, `max_uses`, `uses`, `revoked_at`, `created_at` | the token itself is shown once |
| `watch_party_queue_items` | `id`, `room_id`, `video_id`, `added_by` (member key), `position` (sparse, `playlist-position.ts`), `start_ms`, `played_at`, `removed_at`, `created_at` | |
| `watch_party_messages` | `id` uuidv7, `room_id`, `author_key` (null for system lines), `source` (`app` / `activity` / `discord`), `kind` (`text` / `system`), `body`, `system` (jsonb), `video_id`, `position_ms`, `pinned`, `removed_at`, `created_at` | `video_id` and `position_ms` are where the room was, so 143's history can replay chat without a migration |
| `watch_party_personal_controls` | `user_id`, `target_key`, `room_id` (null for everywhere), `voice_muted`, `volume` (0 to 200), `hide_messages`, `hide_reactions`, `hide_avatar`, `hide_requests`, `block_invites`, `favourite`, `updated_at` | unique `(user_id, target_key, room_id)` with nulls not distinct; accounts only (section 9) |
| `watch_party_interest` | `room_id`, `user_id`, `created_at` | "Interested" on a scheduled room |
| `watch_party_reports` | `id`, `room_id`, `reporter_id`, `target_key` (nullable: a member, else the room), `context` (`room` / `chat` / `voice`), `reason` (`spam` / `abuse` / `sexual` / `violence` / `other`), `details`, `created_at`, `resolved_at` | unique `(room_id, reporter_id, target_key)` |
| `notifications` | adds `watch_party_id` (FK, `ON DELETE CASCADE`) | |

**The room clock** (`watch-party-clock.ts`): `playback` is `{ itemId, phase, positionMs, rate, anchorAt }`, and the `phase`
column is its indexed copy, written in the same statement. The expected position at server time `t` is `positionMs + (t -
anchorAt) * rate` while `playing`, else `positionMs`. Every change is a compare-and-set on `playback_version` and
`roles_version` together: a command carries the version it saw and a stale one is refused with the current state. The
playback version is the fencing token, so a command from a pod that lagged or a client that missed a frame can never
overwrite a newer state; the roles version in the same `WHERE` means a command racing a revoke of the sender's permission
fails as stale and is re-checked against the new roles instead of slipping through. Moderation and role changes write
their system line in the same transaction. No row per seek: a write per scrub is amplification for nothing.

**Settings** are optimistic on `version` (`PATCH` sends it, `VERSION_CONFLICT` otherwise), like video edits.

**Lifecycle**: `open` until the owner (or a holder of `room.close`) closes it, a platform moderator closes it, or the
sweep closes it for idleness (`idle_close` after `last_present_at`; a scheduled room is exempt until an hour past
`scheduled_for`). A room keeps its row 30 days after closing (invites and notifications point at it) and its messages 7
days; room-scoped personal controls and guest ban hashes go with it.

**Limits**: `WATCH_PARTY_MAX_OPEN_PER_USER` (3) open rooms one owner key holds; a fourth create is
`WATCH_PARTY_LIMIT_REACHED`. `idle_close = never` makes a persistent named room ("Friday movie night") that stays until
closed by hand.

### 2. Roles and room permissions

**The registry** (`watch-party-permissions.ts`) is one closed, versioned list, the single source the contracts
(`z.enum` over its ids), the abilities, the role editor and the enforcement spec all read. Each entry is `{ id, group,
since }`, plus its default in each built-in role and preset.

| Permission | Allows |
|---|---|
| `playback.control` | play, pause, seek, rate, next, start, ready check |
| `playback.request` | ask controllers to seek, skip or start |
| `queue.add` | add items; remove one's own pending items |
| `queue.reorder` | move any item |
| `queue.remove` | remove anyone's item |
| `queue.skip` | skip the current item at once |
| `queue.vote` | vote to skip |
| `chat.post` | send chat lines |
| `chat.react` | send reactions |
| `chat.pin` | pin and unpin a line |
| `chat.moderate` | remove lines; mute in chat (assign and lift Chat muted) |
| `chat.bypassSlowMode` | post through slow mode |
| `voice.join` | join the room's voice channel and listen |
| `voice.speak` | publish a microphone in it |
| `voice.moderate` | mute in voice (assign and lift Voice muted), move a speaker to listener, remove from voice |
| `members.invite` | send invites, create and revoke invite links, see pending invites |
| `members.kick` | kick one member, or remove one guest or all guests (they may rejoin) |
| `members.ban` | ban and unban for the room's life |
| `members.joinWhenFull` | be admitted above `capacity` (never above the ceiling) |
| `room.edit` | name, visibility, password, capacity, "Allow guests", chat settings, accent, language and the other settings |
| `room.schedule` | set, move and clear the schedule and `auto_start` |
| `room.close` | close the room |
| `roles.assign` | assign and revoke roles below one's own position |
| `roles.manage` | create, rename, recolour, reorder, edit and delete roles below one's own position, apply a preset |

The three `voice.*` permissions, the Speaker and Voice muted roles and the roster's voice fields live here from the
start, so 141 only plugs in their enforcement and never migrates a room's roles. Until 141 ships, the room resource's
`features.voice` is `false`, the role editor hides voice permissions and roles, and the member menu has no voice items.

**Extending it** is one entry: a new id, `since` set to the next `WATCH_PARTY_PERMISSIONS_VERSION`, and its defaults per
built-in role and preset. When a room whose `permissions_version` is older is loaded, `upgradeRoomRoles` (pure, in
`watch-party-roles.ts`) adds the new permission to its built-in roles per those defaults and leaves custom roles without
it, written back in the same transaction with the new version, so no migration and no backfill job. Every entry must
have an enforcement case in the server spec (the ACs fail on an entry without one); the `voice.*` entries are the only
ones listed as enforced elsewhere, in `PENDING_ENFORCEMENT`, which 141 empties.

**Built-in roles** (`BUILT_IN_ROLES`) cannot be deleted; each can be renamed, recoloured and have its permissions edited,
except that Owner always holds everything and Guest never passes its ceiling. A `grant` role adds permissions; a
`restrict` role lists permissions it removes.

| Role | Kind | Position | Permissions | Why it exists |
|---|---|---|---|---|
| Owner | grant | 1000, always the top | every permission; the only one who can transfer ownership | exactly one, `owner_key`: an account for rooms created in the app, a Discord member for rooms 78's Activity creates; never a guest, never a `watch_party_member_roles` row, never assignable |
| Co-host | grant | 800 | everything except `roles.manage` and `room.close` | a second driver with the owner's day-to-day powers; closing ends everyone's party and editing roles reshapes the room, so both stay with the owner unless granted |
| Moderator | grant | 600 | `chat.pin`, `chat.moderate`, `chat.bypassSlowMode`, `voice.moderate`, `members.invite`, `members.kick`, `members.ban`, `members.joinWhenFull`, `roles.assign` | keeps order without driving playback, so a public room can have moderators who are not DJs |
| Chat muted | restrict | 520 | removes `chat.post`, `chat.react` | a chat mute that leaves voice alone |
| Voice muted | restrict | 510 | removes `voice.speak` | a voice mute (server-mute) that leaves chat alone |
| Spectator | restrict | 500 | removes every permission | watch only, for someone a moderator wants quiet but not gone |
| DJ | grant | 400 | `playback.control`, `queue.add`, `queue.reorder`, `queue.remove`, `queue.skip` | drives the video and the queue in a room where members do not |
| Speaker | grant | 300 | `voice.speak` | talks in a room whose members only listen |
| VIP | grant | 200 | `members.joinWhenFull`, `chat.bypassSlowMode`, `chat.pin` | regulars who always get in and are not slowed down |
| Member | grant | 1 | per preset (below) | every account and Discord member, implicitly; never a row and never revoked |
| Guest | grant | 0, always the bottom | `voice.join` at most | every guest, implicitly; the hard ceiling below |

**Guest's ceiling** (`GUEST_CEILING = ['voice.join']`): a guest's effective permissions are always intersected with it,
after every role, so a guest can never hold `chat.post`, `chat.react`, `voice.speak` or any `queue.*`, `playback.*`,
`members.*`, `room.*` or `roles.*` permission, whatever the role editor or the database says. The editor offers no other
permission for Guest, assigning any role to a guest principal is refused (`WATCH_PARTY_ROLE_ESCALATION`), and a row
inserted by hand changes nothing because the clamp runs last.

Positions decide who may assign what: a Moderator (600) assigns the mutes, Spectator, DJ, Speaker and VIP but not
Co-host; only the owner assigns Co-host. Custom roles (up to 14, so 25 in all; names 1 to 32 characters, an optional
`#rrggbb` colour) take any free position between 2 and 999 below the editor's own, and are `grant` or `restrict`.
Discord members hold roles like accounts do, keyed by their member key; 142 can map Discord server roles onto them.

**Effective permissions** (`effectivePermissions`, pure): the owner holds every permission and never holds a restrict
role. An account or Discord member holds the union of Member and every unexpired `grant` role they hold, minus every
permission an unexpired `restrict` role they hold removes. A guest holds Guest's set within the ceiling. So Chat muted
and Voice muted are independent, a member can hold both, each with its own expiry (10 min, 1 h or the rest of the party),
and lifting one restores exactly what it removed. A member's **top position** is the highest position among their
`grant` roles (Member's 1, Guest's 0). Platform MODERATOR and ADMIN accounts additionally hold `chat.moderate`,
`voice.moderate`, `members.kick`, `members.ban` and `room.close` in every room, for abuse response. A user's own
microphone mute is a client toggle in 141 and personal controls (section 9) are a viewer's own filter; neither is a role.

**Hierarchy and anti-escalation** (`decide-role-edit.ts`, `decide-role-assign.ts`, `decide-member-action.ts`, over the
abilities below), each refusal `WATCH_PARTY_ROLE_ESCALATION` (403) unless named:

1. Nobody puts a permission they do not hold into a role, whether the role grants it or removes it, and nobody puts a
   permission outside the ceiling into Guest.
2. Nobody edits, deletes, moves, assigns or revokes a role at or above their own top position, and nobody moves a role
   to or above it.
3. Nobody kicks, bans, mutes or changes the roles of a member whose top position is at or above their own.
4. The Owner role is never assigned, revoked or edited; its holder changes only by `POST .../owner` from the owner to a
   non-guest member, and the previous owner then holds Co-host. A built-in role cannot be deleted
   (`WATCH_PARTY_ROLE_PROTECTED`, 403). No role is ever assigned to a guest.
5. Nobody changes their own roles except by dropping a `grant` role they hold; nobody lifts their own mute or
   Spectator.

**Presets** (`WATCH_PARTY_PRESETS`) set Member's permissions; every other built-in role starts from the table above
in both. A room records no preset after creation:

- `friends`, the default for a room made from "Watch together": Member gets `playback.control`, `playback.request`,
  every `queue.*`, `chat.post`, `chat.react`, `members.invite`, `voice.join` and `voice.speak`. A party started from a
  video is usually friends, where anyone pausing is the point; the roles that matter there are the mutes.
- `public`, the default for a room made from `/parties`: Member gets `playback.request`, `queue.vote`, `chat.post`,
  `chat.react` and `voice.join` (listen only). A room of strangers needs a driver, so the owner hands out DJ, Speaker
  and Moderator.

Anyone with `roles.manage` can edit any role afterwards, or apply a preset again (`POST .../roles/preset`), which resets
every built-in role but Owner to its defaults and touches no custom role and no assignment.

**Abilities, never hand-checks**: `@vp/permissions` gains a room-scoped ability,
`getWatchPartyPermissions(principal, viewer)`, where `viewer` is `{ permissions, topPosition, isOwner, kind }` from
`toWatchPartyViewer` (`normalizers/watch-party.normalizer.ts`). `rules/watch-party.rules.ts` turns each held permission
into `can(permission, 'WatchParty')`, and the hierarchy into conditions on subjects: `assign` and `revoke` on
`WatchPartyRole` with `{ position: { $lt: topPosition }, key: { $ne: 'owner' } }` (Chat muted through `chat.moderate`,
Voice muted through `voice.moderate`, the rest through `roles.assign`), `create`, `update`, `delete` and `move` on
`WatchPartyRole` under the same conditions through `roles.manage`, `grant` on `WatchPartyPermission` with `{ id: { $in:
permissions } }`, and `kick`, `ban` and `mute` on `WatchPartyMember` with `{ topPosition: { $lt: topPosition }, isOwner:
false }`, and `assign` never on a `WatchPartyMember` whose `kind` is `guest`. Every room action on the server, REST or
socket, is decided through these; the web app's controls render through `<Can>` fed by a room-scoped provider over the
same ability.

**Live changes**: every role or assignment change bumps `roles_version` in its transaction, writes a system line, and
publishes `roles` (the role list) or `member.roles` (one member's role ids with their expiries). Each pod recomputes the
effective set of every socket it holds in that room from the frame; each client recomputes its own with the same
`effectivePermissions`, so a control disables or appears within one broadcast. An expiring mute needs no job:
`effectivePermissions` ignores an expired row, the client schedules its own refresh at the expiry, and the sweep
deletes expired rows.

### 3. Identities, guests and the roster

**Three kinds of principal, one room model.** `watch-party-principal.ts` defines `PartyPrincipal`: `{ kind: 'user',
userId }`, `{ kind: 'discord', discordUserId, name, avatarUrl }` or `{ kind: 'guest', guestId, name }`, and its member
key. Memberships, role assignments, bans, budgets, presence, chat authorship and queue additions are all keyed by the
member key, so a ban on `discord:<id>` holds whether that person arrives through the Activity, a bridge or the web.

**Party credentials.** A guest and a Discord member hold a **party credential**, not an app session: an opaque random
token (32 bytes) whose SHA-256 keys a Redis entry (`PartyGuestSessionsPort`) holding the principal and, for guests, the
IP hash, with a 12 h sliding TTL. The web keeps it in an httpOnly, `SameSite=Lax` cookie `vp.party-guest`; the app's
`/api` proxy forwards it as `X-Party-Credential`, never as `Authorization`. The auth plugin resolves it **only** on
routes whose contract sets `partyGuest: true` (the room preview, join, leave, socket ticket, seat upgrade, roster,
personal controls for the room); on every other route it is ignored and the caller is anonymous, so a party credential
gets 401 from `/v1/me/...` and every other protected route. `tests/architecture/` gains a check that `partyGuest: true`
appears only in the watch-party contract files. 140 issues guest credentials; 78 issues Discord ones through the same
port (Discord OAuth `identify`, its state nonce, no account).

**Guests** (anonymous, 140):

- `POST /v1/watch-parties/:id/guest` creates the guest credential and seat in one step, when the room has `allow_guests`
  (on by default for public and unlisted rooms, off for private ones; a private room with it on still needs an invite
  link). The nickname is generated, "Guest 4821" (four digits unique in the room), never chosen, so nobody can pose as
  someone else.
- Limits: 5 guest credentials per IP per hour, 30 guest joins per room per minute, guests count toward capacity and
  the ceiling, and the IP hash (HMAC with a per-room salt) is kept only for a guest ban and dies with the room.
- They watch in sync, read chat and the roster and, with voice on, listen; the Guest ceiling refuses everything else
  on the server.
- **Upgrade in place**: "Sign in" or "Join with Discord" from inside the room returns to the same URL, and the client
  calls `POST /v1/watch-parties/:id/seat/upgrade` with both credentials. One transaction moves the seat to the new key
  (membership, presence entry, the guest's ban check against the new key, and a guest ban carried to the new key), the
  hub tells the pod holding the socket, which swaps the socket's principal and sends `you`; the socket stays open and
  playback never stops. A new identity that is banned closes the seat instead; one that already holds a seat in the room
  supersedes the older socket.

**Discord members** (78 issues the credential, 142 relays bridge identities): Member by default (or a mapped role with
142), watch, chat, react and talk within the roles; no invites to them (no bell), no room ownership. Only the Discord
id, display name and avatar URL are stored. Linking a Taitube account later (78) re-keys their seats in open rooms from
`discord:<id>` to `user:<uuid>`, carrying roles over (a union with any the account already holds there) and copying bans
to the new key, so linking never lifts a ban.

**The roster** (`watch-party-roster.ts`) is one list of everyone in the party, whatever their path:

```
RosterEntry {
  memberKey, kind: user | discord | guest,
  source: app | activity | discord_chat,
  name, avatarUrl, roleIds, ready,
  sync: lobby | in_sync | catching_up | buffering,
  voice: off | listening | live | self_muted | server_muted,
  away: boolean
}
```

- `hello` carries the full roster; `roster.patch` frames carry changes, batched every 500 ms per room so 200 people
  joining at once is a few frames. Speaking indicators are not roster traffic: 141 reads them from the SFU on each client.
- `away` is set by the client after 2 minutes hidden or 10 minutes without input, and cleared on return.
- Guests collapse into one "N guests" group for everyone but holders of `members.kick`, who see each guest to remove one,
  or all of them at once.
- `source` is badged everywhere the person appears: an app member plain, an Activity member with the Discord mark, a
  bridged chat member with "via Discord".

**Who is shown outside the room** (`toRosterPreview`, the one projection every outside surface uses: the preview,
discovery cards, the invite notification, 78's and 142's embeds and Rich Presence):

- Public and unlisted rooms: up to 5 faces and names of account members whose new `privacy.showInParties` preference
  (account scope, default on, "Show me in party previews and on Discord") allows it, then counts: "+N" for everyone else,
  split by source ("+3 from Discord", "+12 guests").
- Discord members appear by name only on Discord surfaces (78's and 142's embeds); on app surfaces they are counted.
- Private rooms: counts only, except the invite notification, where an invitee sees up to 2 names who allow it.
- The invite notification snapshots `watching` when it is created ("Ana, Tom and 3 others are watching"); the room page
  shows the live roster.
- Rich Presence shows the party size, never names.

### 4. Joining: access, passwords, invites and capacity

`decideWatchPartyJoin` (pure, `@vp/domain-rules`) decides in this order, each a typed failure:

1. Closed -> `WATCH_PARTY_CLOSED` (410).
2. Banned from this room (by member key, or for a guest by IP hash) -> `WATCH_PARTY_BANNED` (403).
3. A guest in a room without `allow_guests` -> `WATCH_PARTY_GUESTS_OFF` (403).
4. Access: a member already, a valid per-recipient invite for the caller, or a valid invite link -> granted, password
   skipped. Otherwise a `private` room -> `WATCH_PARTY_NOT_FOUND` (404, no existence leak); a password set and none sent
   -> `WATCH_PARTY_PASSWORD_REQUIRED` (403, not 401, so the client's session refresh never fires on it); a wrong one ->
   `WATCH_PARTY_PASSWORD_INVALID` (403).
5. Capacity -> `WATCH_PARTY_FULL` (409, with `present` and `capacity`).

An account or Discord joiner holds Member, a guest holds Guest.

**Passwords**: 4 to 64 characters. Hashed with scrypt through `node:crypto` (`N = 2^15`, `r = 8`, `p = 1`, 16-byte salt,
32-byte key, encoded `scrypt$N$r$p$salt$hash`), async so it runs on the thread pool, compared with `timingSafeEqual`.
Behind `PasswordHasherPort`; one class serves both adapter families with the cost from config (cheap in specs). Not
argon2: the repo has no hasher today, `argon2` is a native addon outside the dual-runtime image story, and `Bun.password`
is a `Bun.*` API rule 2 forbids; `node:crypto` scrypt runs under Node and Bun. **Attempts**: the gate's budget is checked
before hashing, 5 failures per 15 minutes per member key and per IP per room, then `WATCH_PARTY_PASSWORD_LOCKED` (429,
`Retry-After`); a success clears the caller's count. Changing the password keeps current members and every live grant.

**Invite links**: `POST .../invite-links` with `ttl` (`1h`, `24h` default, `7d`) and optional `maxUses`; 32 random bytes,
base64url, stored as SHA-256, shown once. The URL is `/parties/<id>?invite=<token>`; the page swaps it for the bare URL
after joining, so it does not stay in history or a copied address bar. Revoking or expiring a link stops new joins and
never removes members.

**Capacity** (`watch-party-capacity.ts`):

- `capacity` is optional; `null` means up to the operator ceiling `WATCH_PARTY_MAX_MEMBERS` (default 200). A holder of
  `room.edit` sets 2 to the ceiling when creating or editing. 200 is chosen because a room is one Redis channel and every
  pod holding one of its sockets writes every broadcast to each: at the chat burst budget (5 lines per 10 s per member)
  200 members is a worst case of 100 lines per second fanned to 200 sockets, which S8 (section 18) holds on one API pod
  with headroom, and above it a room would need sharded fan-out this ticket does not build.
- It counts **present** people of every kind: open sockets, admitted atomically in Redis
  (`WatchPartyPresencePort.admit`, a Lua script that prunes stale entries, admits a member already present, and otherwise
  admits only below the limit), so two pods cannot both admit the last spot. The REST join pre-checks the same count for
  a fast answer; the socket upgrade decides. 142's bridged members count as present while the bridge reports them.
- **Everyone counts** toward the number shown ("12 / 12"), the owner, moderators and guests included. The owner is
  **never refused**, so they can always get back into their own room; members with `members.joinWhenFull` (Co-host,
  Moderator and VIP by default) are admitted above `capacity` but never above the ceiling.
- **Lowering** the limit below the current count kicks nobody; the room shows "13 / 10", and joins are refused until
  present drops below the new limit.
- **Invites do not bypass it**: a per-recipient invite and an invite link skip the password, never the limit.
- What a joiner sees when full: on the room page, a "This party is full (10 of 10)" panel with the current video and the
  roster preview, a "Watch on your own" link to the video, and the count re-read every 10 s while the tab is visible;
  when a spot opens, Join enables and a polite announcement says so. From an invite, the notification row opens the same
  panel and stays actionable (the invite is not used up). From discovery, the `space=true` filter leaves full rooms out;
  without it a full card shows a "Full" badge and its button opens the same panel.

### 5. The room socket and the sync protocol

**Transport, decided: one WebSocket per member per room**, `GET /v1/watch-parties/:id/socket?ticket=&after=`, carrying
sync, chat, reactions, the roster, role changes and requests.

- Not 98's user stream: it is one-way, per user and log-backed with up to a second of outbox relay latency, and a room
  member sends often (commands, clock pings, chat, reactions, ready, buffering and away flags). ADR-27 already names a
  room as the case for a socket.
- Not a second socket for chat: one ticket, one connection, one ordering, so the "now playing" system line and the state
  change arrive in the order they happened.
- The mechanics are 76's: a one-time ticket from `POST .../socket-ticket` through the app's `/api` proxy (for an account,
  a guest or a Discord member alike; the ticket grant carries the member key), `Origin` checked against `CORS_ORIGINS`
  before the upgrade, a refusal answered as an HTTP Problem before upgrading, `keepAlive` pings and the buffered-bytes
  cut-off, `sendSocketResult` for an `error` frame on an open socket. The pattern-subscribing hub is extracted from
  `LiveChatHub` into one generic `apps/server/api/src/services/pattern-hub.ts` used by both, not copied.
- **Fan-out across API replicas** (HPA 2 to 10, no sticky sessions): every change is published on `watch-party:{roomId}`
  through `CacheClient.publish`; each pod holds one pattern subscription `watch-party:*` and writes to the sockets it holds.
  The in-memory `CacheClient` does the same, so a spec runs two Fastify apps over one cache to prove cross-pod delivery.
- **One socket per member per room**: a second one (another tab or device) supersedes the first, which gets `superseded`
  and closes. That also stops one person holding several spots.

**Order on connect**: redeem the ticket, check membership, ban and phase, admit to presence (capacity), join the hub, read
the chat backlog after `?after=`, write `hello` (room, roles and `rolesVersion`, `you` with the caller's member key and role
ids, the room clock with `serverNow`, the queue, the roster, chat mode, pinned line), the backlog, then what arrived
meanwhile, each once (76's ordering).

**The clock on the client** (`watch-party-clock.ts`, shared): the client sends `clock { t0 }` on connect and every 30 s,
the server answers `clock { t0, serverNow }`, and the client keeps the offset of the lowest round-trip of its last 8
samples (NTP's minimum filter). The server's time is the pod's wall clock: pods are NTP-synced and their skew is far under
the 250 ms threshold below, and `watch_party_clock_skew_seconds` (each pod against Postgres `clock_timestamp()`, sampled
by the poller every minute) alerts if that stops being true.

**Commands** (`playback.control`): `play`, `pause { positionMs }`, `seek { positionMs }`, `rate { rate }` (0.5, 0.75,
1, 1.25, 1.5, 2), `next`, `start` (lobby -> playing after a 3 s countdown: the anchor is `now + 3000`), each with the
`version` it saw. The pod applies it as one CAS and publishes `state { playback, version, by, reason }`; the sender gets
`ack`. A stale version gets an `error` frame `WATCH_PARTY_STATE_STALE` with the current state, and the client re-applies
on top; a missing permission is `WATCH_PARTY_PERMISSION_MISSING` naming it. Commands are budgeted 6 per 5 s per member
across pods (the gate), so a stuck key cannot flood the room.

**Drift correction** (`watch-party-drift.ts`, constants `WATCH_PARTY_DRIFT`): once a second the client compares its
`currentTime` with the expected position.

| Drift | Action |
|---|---|
| under 250 ms | nothing |
| 250 ms to 2 s | nudge `playbackRate` by 5 % toward the room (room rate times 0.95 or 1.05) until within 100 ms, then back to the room rate |
| over 2 s | hard seek to the expected position plus the measured seek latency, then no correction for 3 s |

250 ms because two people talking over a call notice a gap of about a third of a second; 2 s because a 5 % nudge
closes 2 s in 40 s, past which a seek is less noticeable than a long speed change. Every 30 s the client reports its
absolute drift and hard seeks in a `stats` frame; the server records them (section 17).

**Late joiners**: `hello` carries the state; the player loads the item, seeks to the expected position at load time and
plays. Browsers refuse unmuted autoplay without a recent gesture: when `play()` is refused the client plays muted and shows
a "Tap for sound" chip, and never blocks sync on it.

**Reconnect**: the client fetches a new ticket (tickets are one-time) and reconnects with backoff (1 s to 30 s, as
`use-live-chat.ts`), resuming chat with `?after=`; the state, roles and roster need no replay because `hello` is a full
snapshot. While disconnected the player keeps playing on the last known clock, and a "Reconnecting" badge shows on the
stage.

**Buffering**: members send `buffering { true | false }`. With `buffer_policy = wait` and at most 12 present members, a
member buffering for more than 1.5 s makes the server pause the room with `reason: buffering` (the system as actor); it
resumes when nobody is buffering or after 10 s, and a member still buffering then is left to catch up through drift
correction, marked "Catching up". Above 12 members, or with `continue`, the room never waits: one bad connection must not
stall a large room. Guests never pause the room. The player port gains `buffering` and `ended` in `PlayerState`,
implemented by the Video.js engine.

**Owner leaving**: an owner whose socket closes keeps ownership for a 60 s grace (a reload or a network blip). After it,
ownership passes to the present **non-guest** member with the highest top position (the longest present on a tie) as one
CAS on `owner_key` and `roles_version`, with an `owner` broadcast and a system line; the previous owner holds Co-host
when they return. With only guests present, ownership waits until someone else is. The pod that saw the close schedules the
check; the sweep (section 1) catches it if that pod died. The owner can transfer at any time. A room with nobody present
closes per `idle_close`.

**Queue end**: `ended` from any present client is accepted when the expected position is within 2 s of the item's
duration; with `autoplay` the room advances to the next item by CAS, otherwise it pauses at the end. After the last item
the phase becomes `finished`, and adding an item offers Start again.

**Mid-party changes**: a member's player still reads each video through `GET /v1/videos/:id` (`decideVideoRead`, which
for a guest or Discord member is the anonymous read), so a room never grants playback rights. The platform has no age
gate today; when one lands it holds through that same per-member read, and a member who loses access sees "Not available
to you" while the room plays on. The sweep and every advance re-check `decideWatchPartyShareable` on the current and
queued items: a video that turned private, was deleted or stopped being shareable for the room's visibility is removed
from the queue with a system line ("This video is no longer available"), and the room skips to the next item within a
minute. Ads: the platform serves none, so there is nothing to sync.

### 6. Room chat, reactions and requests

- **Chat** reuses 76's pieces, not its table: `validateChatMessage` (1 to 200 characters, one line), the gate's burst
  (5 lines per 10 s per member key across pods), slow mode, the resume cursor (200 lines, `fresh` / `replayed` /
  `expired`), and the kit `LiveChat` (`apps/client/web/src/components/live/live-chat/`) under a `PartyChat` smart wrapper.
  Lines go to `watch_party_messages`, **stored before they are published** (76's rule). `live_chat_messages` is keyed by a
  live stream with a broadcast offset, which a room has neither of. A send needs `chat.post` and re-reads the room's
  `roles_version` from Redis first, so a mute applied on another pod a moment earlier is honoured. Each line carries its
  `source`, so 142's bridged lines show "via Discord".
- **Role badges**: each line shows the author's highest role that has a colour (Owner, Co-host and Moderator have
  built-in icons too); system lines carry none.
- **System lines** (joined, left, now playing, owner changed, role assigned or revoked, settings changed, removed by a
  moderator) are stored rows, so a reconnect shows them; each viewer can hide them (section 11).
- **Timestamps** typed as `12:34` render as a chip; a click from someone with `playback.control` seeks the room, anyone
  else's sends a request.
- **Pinned line**: `chat.pin` pins one line, shown above the list.
- **Moderation** through permissions: `chat.moderate` removes a line and mutes in chat (assigns Chat muted, 10 min, 1 h
  or the rest of the party; voice is untouched), `members.kick`, `members.ban`, and slow mode and chat off through
  `room.edit`. Each is a system line and a log line, and each obeys the hierarchy.
- **Reactions** (`chat.react`): a fixed palette of 8 emoji (in the catalogue, not free text). `react { emoji }` is
  budgeted 10 per 5 s per member; each pod folds reactions per room over 250 ms into one `reactions { counts, from }`
  frame, so 200 people reacting at once is a few frames per second, not 200 times 200. Not stored.
- **Requests** (`playback.request`): `request { kind: seek | skip | start, positionMs? }` reaches the sockets whose
  holder has `playback.control` as an actionable toast ("Ana asks to jump to 12:34", Accept or Dismiss). Budgeted 3 per
  minute per member.

### 7. The shared queue and playlist autoplay

- Server-side `watch_party_queue_items`, ordered with 73's sparse positions (`appendPosition`, the midpoint move,
  `renumberPositions`), at most 200 items.
- **Sources at create**: a video (optionally `startMs`, from the watch page's playhead or a clip's start), a playlist
  (its items the creator can read and the room may share, copied once: a later edit to the playlist does not surprise
  the room; collaborative live-linked playlists are [119](119-playlists-customisation-and-collaboration.md)'s), or the
  local player queue (73's `PlaybackSession` videos in order, starting at the current one).
- **Who edits** is permissions: `queue.add` (at most 3 pending items per member unless they also hold `queue.reorder`,
  and removing one's own pending items), `queue.reorder`, `queue.remove`, `queue.skip`. Edits go through REST (`POST`,
  `PATCH`, `DELETE` on `.../queue`), so 78's bot and a card menu can add without a socket; every edit broadcasts
  `queue { items, version }`.
- **Vote to skip** (`queue.vote`): `skipVote { itemId }` over the socket; the room skips when votes reach
  `skip_vote_percent` of present members holding `queue.vote` (rounded up). Votes reset per item; `votes { itemId, votes,
  needed }` shows the tally.
- **Autoplay** advances on end (section 5); shuffle is an action that reorders the remaining items, not a mode.
- The UI renders 73's `Queue` kit (side, below and sheet layouts, keyboard reorder with announcements) under a
  `PartyQueue` wrapper, plus who added each item.

### 8. Invites and notifications

- **Kinds**: `party_invite` and `party_starting` join `NOTIFICATION_KINDS` in `@vp/domain`. The `notifications`
  preferences section gains `watchParties` (flag, default on) for both kinds and `watchPartyInvites` (choice: `everyone`
  default, `subscriptions` meaning people whose channel the user subscribes to, `nobody`), both account scope, so each
  user changes them in settings. The payload gains `party: { roomId, name, videoTitle, scheduledFor, inviteId,
  expiresAt, watching: { names, count } } | null`; `actor` is the inviter's channel.
- **Producers**, through the outbox in the transaction of their cause (SDD §10.4): `WatchPartyInviteRepository.create`
  writes `notify-party-invite`; scheduling writes `notify-party-reminder` (section 13). The job id names the cause
  (`<inviteId>--notify-party-invite`).
- **Grouping**: `party_invite:<roomId>` folds several people inviting the viewer to the same room ("Ana and 2 others
  invited you to Movie night"); `party_starting:<roomId>`.
- **Expiry**: an invite expires at the later of 24 h after sending and 6 h after `scheduled_for`, and when the room
  closes. The row stays in the bell; its CTA turns into "Ended" once `expiresAt` passes, and a click still opens the room
  page, which says the party ended.
- **The row** (99's `NotificationRow` in `features/notifications/components/`): the **whole row is the join link**
  (`/parties/<id>?invite=<inviteId>`, the per-recipient grant), with a visual "Join" pill inside it as its call to action
  (not a nested button; the link's accessible name ends in "Join"), and the `watching` line from the snapshot ("Ana, Tom
  and 3 others are watching", section 3's rules). Decline is a sibling icon button after the link, a new
  `NotificationCentre.ItemAction` kit part (44 px target, inline-end); it calls
  `POST /v1/me/watch-party-invites/:id/decline` and marks the notification read. An invite arriving live shows a toast
  with Join, as 99 does for replies.
- **The inviter's view** (`members.invite`): pending and joined invites, with revoke; a decline shows as nothing (it stays
  "pending" until it expires), so declining carries no social cost.
- **Inviting**: an "Invite people" picker in the share dialog and the People tab, backed by
  `GET /v1/watch-parties/:id/invite-candidates?q=`: people from parties the viewer was in during the last 30 days, owners
  of channels the viewer subscribes to, and a handle or name prefix match (47's channel suggestions), each with
  `inRoom` and `invited` flags. Up to 20 per request, 30 per hour per account, 50 pending per room; re-inviting the same
  person inside the group window folds. An invitee whose `watchPartyInvites` refuses the inviter, who switched
  `watchParties` off, or who set `block_invites` on the inviter (section 9) is reported in `refused` without saying why.
  Guests and Discord members cannot invite through the bell (it needs an account on both ends); they can copy the link.
- **Link copy and QR**: the share dialog copies the room URL, or an invite link (24 h) when the room is private or has a
  password ("Link skips the password", on by default), shows a QR code (`qrcode`, SVG, in the dialog's lazy chunk; no
  network) and uses the Web Share API where the browser has it, which reaches the Discord app on a phone.

### 9. Personal controls

What one viewer chooses for themselves about another member: never moderation, never a role, never visible to the
target, and never sent to anyone else.

| Control | Effect, for the viewer only |
|---|---|
| Mute their voice, and their volume (0 to 200 %) | 141 unsubscribes from their track when muted (no bandwidth spent) and applies the volume through the SFU client's per-participant gain |
| Hide their messages ("block messages") | their lines render as one collapsed "Hidden message" row with "Show anyway" per message; their bridged lines too |
| Hide their reactions | their reactions, and in 143 their flying comments and soundboard, are left out of the overlay |
| Hide their avatar | a neutral placeholder in the roster, chat and tiles |
| Hide their requests | their seek, skip and start requests never toast (for controllers) |
| Block their invites | everywhere scope only: their party invites to the viewer are refused on the server (section 8), still without telling them |
| Favourite | highlighted in the roster and sorted to its top, their lines highlighted, and a "Favourites" chat filter |

- **Scope, the viewer's choice per control**: **this room** (the default) or **everywhere** (every room the viewer is in
  with that person). An account stores both in `watch_party_personal_controls` (`room_id` set for this room, null for
  everywhere), behind `GET` and `PUT /v1/me/watch-party-controls` (`partyGuest: true`, so a seat's room-scoped ones work
  too); a change emits a new 98 event `party.controls.updated`, so another device applies it live. Not 97's preferences:
  97's sections are fixed-shape settings, and this is an open-ended list keyed by target that needs per-row writes.
- **Guests and Discord members** get room-scoped controls only, kept in the browser's `localStorage` per room (wrapped in
  `try`/`catch`; lost with the storage, which is acceptable for a room-only filter); "Everywhere" needs an account and says
  so.
- **Targets** are member keys: an account's user id, a Discord id, or a guest key (room scope only, since a guest key
  dies with the seat). When a Discord member links an account (section 3), everywhere controls on their Discord key also
  apply to the account key.
- **Applied on the client**: the server sends every line and reaction to every socket as before; filtering in the viewer's
  client is what keeps the target from noticing anything. `block_invites` is the one control the server reads.
- **Not a platform block**: these stay party-only. The app has no user block today; when one is built it should imply
  every control here everywhere, and this table would then be read beside it, not merged into it.
- **UI**: the member menu in the roster and on a chat author's name ("Mute for me", "Volume", "Hide messages", "Hide
  reactions", "Hide avatar", "Hide requests", "Favourite", each with "In this room" or "Everywhere"), 141's volume slider
  on the voice tile, a small "Hidden by you" or "Muted for you" mark on the person in the viewer's own roster with a
  one-click undo, and a "Manage personal controls" page at `/settings/party-controls` listing every everywhere entry with
  remove.

### 10. Entry points

All open the same `WatchTogetherDialog` (`features/watch-party/components/`, through `lazyComponent`), which creates the
room on open with the `friends` preset (`source` from where it was opened; the caller's unstarted room for the same source
from the last hour that nobody joined is reused rather than duplicated) with the link field, Copy (first focus), QR,
Share, Invite people, and a "Room settings" disclosure (name, visibility, password, capacity, Allow guests, "Who can do
what" with the preset choice and a link to the role editor, start-at toggle "Start at 12:34", host as channel, schedule,
accent), then "Go to party". A quick party is `unlisted`, guests allowed, chat on, no capacity, no password, `idle_close`
15 minutes.

| Where | Action |
|---|---|
| Watch page engagement bar (`watch-engagement-bar.tsx`) | "Watch together" beside Share, starting at the playhead when it is past 0 (toggle, like the share dialog's) |
| Player control bar (`features/player/components/control-bar.tsx`) | a "Watch together" button, working in fullscreen (the dialog portals into the fullscreen element) |
| Queue (`features/watch/components/watch-queue.tsx`) | "Watch together" in the queue header: the whole queue from the current video |
| Playlist page (`features/library/components/playlist-hero.tsx`) | "Watch together" beside Play all |
| Clip page (`features/clips/components/clip-page.tsx`) | "Watch together" from the clip's start |
| Video card menu | "Watch together", and "Add to party queue" while the viewer is in an open party where they hold `queue.add` |
| Command palette | "Start a watch party", "Join a party from a link" |

Creating a room needs an account; signed out, each action opens sign-in, as `ClipAction` does.

### 11. The party page

`/parties/$roomId` (`routes/parties.$roomId.tsx`). SSR loads the preview (`GET /v1/watch-parties/:id`) for public and
unlisted rooms, for the head and the first paint; the socket is client-only. A visitor with no seat sees the preview
(name, owner, current video and progress, the roster preview of section 3) with up to three actions: **"Watch as
guest"** (when the room allows guests), **"Join with Discord"** (only when 78's Discord integration is configured) and
**"Sign in"**, which returns to the same URL and invite. With guests off, only the sign-in options show. A guest's page
has a persistent "Sign in to chat" bar that upgrades the seat in place.

**Layout** (compound `PartyRoom` in `components/party/party-room/`: `Root`, `Stage`, `Header`, `Panel`, `Tabs`, `Overlay`):

- **Expanded and large**: the stage (player, ambient glow) with the room header above (name, owner, phase, count, Invite,
  Settings for those who hold `room.edit` or `roles.manage`, Layout menu) and a 360 px panel at inline-end with tabs Chat,
  People, Queue. Reactions bar under the stage.
- **Theater**: stage full width, the panel below it. **Focus**: panels hidden, chat as the live overlay (76's, with its
  opacity slider). Fullscreen uses the overlay too.
- **Medium**: stage full width, panel below.
- **Compact**: player sticky at the top at 16:9, then a `SegmentedControl` for Chat, People, Queue; the composer pinned
  above the keyboard (`dvh` units); reactions as a strip above the composer; landscape goes fullscreen with the overlay;
  room controls in a sheet.
- **Lobby**: the stage shows the first item's poster with "Waiting to start", or the scheduled countdown; the roster as
  an avatar grid with ready ticks ("4 of 6 ready"; guests as a count); Start and Ready check for `playback.control`; chat
  and queue as in the party.
- **People tab, the roster** (`components/party/roster/`): grouped Present, then Away, then not present, each row with
  avatar, name, source badge, role badges in their colours, sync state, voice state (when 141 is on) and the viewer's own
  personal-control marks; "N guests" as one collapsible row. The member menu shows only what the viewer may do to that
  member: moderation (a Roles submenu with a checkbox per assignable role, roles at or above the viewer's position
  disabled; "Mute in chat" and, with voice, "Mute in voice", each for 10 min, 1 h or the party; Kick; Ban; Transfer
  ownership for the owner) and, separated, the personal controls of section 9.
- **Role editor** (`components/party/role-editor/`, in room settings, for `roles.manage`): roles listed by position, each
  with its colour swatch, name, member count and the permission checkboxes grouped as the registry groups them
  (Playback, Queue, Chat, Voice, Members, Room, Roles). Rows at or above the editor's position are read-only, a
  permission the editor does not hold is disabled with "You can only grant what you have", and Guest offers only its
  ceiling. Reorder by drag or keyboard (73's pattern) within the editor's range; New role; Delete for custom roles; "Apply
  preset" (Friends, Public) with a confirm. Changes save per role (`PATCH` with the role's `updatedAt` as its guard) and
  arrive live in every open editor.
- **On the stage**: a sync badge (In sync, Catching up, Reconnecting), "Ana paused" style notices in a polite live region,
  the countdown, request toasts for `playback.control`, and the reaction overlay (`components/party/reaction-overlay/`):
  emoji rise and fade on the motion tokens; under reduced motion they become static count chips.
- **Who controls**: without `playback.control`, play, pause and seek are disabled with "You can't control playback in
  this party" and, with `playback.request`, a Request button; keyboard (`k` or Space, `j` and `l`, `c` to chat, `r` for
  reactions, Escape) follows the same abilities. A permission granted or revoked mid-party changes the controls at once.
- **Customization, per viewer**: the Layout menu sets layout (`side`, `below`, `theater`, `focus`), chat overlay in
  fullscreen, reaction overlay on or off, and system lines on or off. Saved in a new 97 section `party` (scope `both`,
  so a device can differ from the account) for accounts, `localStorage` for guests and Discord members, applied with no
  layout shift on load because SSR reads the cookie copy as 97 does for appearance.
- **Room accent**: `room.edit` picks a swatch or a custom `#rrggbb` (`ACCENT_PATTERN`), or "Channel colour" for a room
  hosted as a channel; the page wraps in `BrandScope`, which never touches `live`, `danger` or status roles and yields to
  the viewer's own accent. Role colours are separate and only tint badges.
- **States** (design README [section 8, States](../design/README.md#states)), each with a story: loading (the exact
  layout as a skeleton), preview with each combination of the three actions, guest, password, full, banned, guests off,
  not found, closed ("This party ended", with its last video), kicked, chat-muted (the composer replaced by "You are
  muted in chat until 20:15"), spectator, reconnecting, offline (the player keeps going on the last clock; chat
  read-only), partial (chat failed to connect while sync works, and the reverse), empty queue, lobby, finished.
- **Head**: `noindex, nofollow` always (rooms are ephemeral). Public and unlisted rooms get Open Graph and Twitter tags
  through `features/seo/page-head.ts` (title "<name> - watch party", the video's thumbnail, "Watching <title> with N
  people"); a private room gets the generic "Join a watch party on Taitube" with no name or image. That is what Discord,
  Slack and messengers unfurl. Guests change nothing here: a guest reaches only rooms whose link they have.

**Design**: no screen exists for parties or rooms (`docs/design/screens/web/` has none). Slice 2 adds
`docs/design/screens/web/party.html` (the preview with its actions, lobby, party in side, theater and focus layouts,
compact portrait and landscape, fullscreen overlay, the join panel states, the share dialog with QR, the invite picker,
the member menu with moderation and personal controls, the role editor), the component docs `party-room.md`,
`roster.md`, `reaction-overlay.md`, `role-editor.md`, `personal-controls.md`, a `party` icon in
`packages/client/ui/src/icons/inventory.tsx`, the invite row in `docs/design/apps/web/notification-centre.md`, and the
wrapper rows in [the wrapper table](../design/apps/web/README.md#smart-wrappers), before the components are built. Every
surface meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).

### 12. Discovery: `/parties`

**Route and nav**: `routes/parties.index.tsx`. The rail's main group gains "Watch parties" after Live (the `party` icon,
`compact: false`), in `features/shell/shell-destinations.tsx`. On compact, where the tab bar is full, it is a "Watch
parties" row in the You hub (`/feed/you`). The command palette gets "Browse watch parties" everywhere.

**Filters, all in the URL**, typed by a zod `validateSearch` with the `preprocess` fallback `routes/search.tsx` uses (a bad
value falls back to its default, never an error page), so any filtered view is a shareable link:

| Param | Values | Meaning |
|---|---|---|
| `q` | text, `validateSearchQuery` (47) | room name, owner handle or name, current video title |
| `status` | `all` (default), `now`, `lobby`, `scheduled` | playing or paused; gathering; `scheduled_for` in the future |
| `category` | category id | the current video's category |
| `language` | a primary subtag from the supported list | the room's language, which `room.edit` sets (default the owner's locale) |
| `access` | `any` (default), `open`, `password` | |
| `size` | `any` (default), `small` (up to 10 present), `medium` (11 to 50), `large` (over 50) | |
| `space` | `true` | present below the room's effective capacity |
| `followed` | `true`, signed in only | the owner's channel, or a present member's channel, is one the viewer subscribes to |
| `creator` | `true` | hosted as a channel (`as_channel_id` set) |
| `kind` | `any` (default), `single`, `playlist` | `queue_length` 1, or more than 1 |
| `sort` | `members` (default), `newest`, `starting_soon`, `trending` | |

**API**: `GET /v1/watch-parties` with those params plus `cursor` and `limit` (1 to 48, default 24), answering `{ items:
WatchPartyCard[], nextCursor }`. Keyset per sort with the repo's `Paginator` and `Base64UrlCursorCodec`: `members` on
`(present_count desc, id)`, `newest` on `(created_at desc, id)`, `starting_soon` on `(scheduled_for, id)` (implies
`status=scheduled`), `trending` on `(trend_score desc, id)`; the cursor carries its sort and is refused under another
(`INVALID_CURSOR`). Counts move between pages, so a members-sorted walk can repeat a room; the client drops repeats by
id. `trend_score` is written by the sweep each minute as `(joins in the last 30 min + present_count) / (age in hours + 2)
^ 1.2`, so the sort is an index walk, not a computation per request.

**Search**: 47's engine on Postgres, not a new index: `search_text` (room name, owner handle and display name, current
video title, rewritten when any of them changes) feeds a generated `simple` tsvector with 47's weights and
`websearch_to_tsquery`, with the `pg_trgm` `word_similarity` fallback when words match nothing, through 47's text-match
helpers (`postgres/repositories/search-query.ts`). Rooms do not join `GET /v1/search`: they live for hours and a search
result that 404s an hour later is worse than none.

**What is listed** (`watchPartyListScope` in `postgres/scopes/`, 108's pushdown): open, `public`, not hidden, not
auto-hidden by reports, the current item public (or no item yet), and not a room the viewer is banned from. Password rooms
are listed with a lock; a card says whether guests are welcome.

**Cards** (`components/party/party-card/`, `PartyCard` wrapper): the current video's thumbnail with a progress bar that
moves locally from the card's clock snapshot (no push per second), room name, owner avatar and name (the channel badge
when hosted as a channel), a phase pill (Now playing, Lobby, Starts 20:00), the roster preview ("12 watching" with up to 5
faces and the "+N" counts of section 3), "12 / 20" when capped, the lock, the language, "Playlist, 8 videos", and Join.

**Live updates**: `GET /v1/watch-parties/events`, an anonymous SSE stream on 98's `SseHub` with a new channel type
`parties`: `party.counts` (batched every 2 s), `party.opened` (a card), `party.updated` (name, current video, phase,
roster preview) and `party.closed` (id). The page opens it only while visible and online; counts patch the cards in the
infinite query cache, a closed card turns "Ended" in place (no reflow; it drops on the next refetch), and new rooms
matching the filters (the card carries every filter field, so the client matches) raise a "3 new parties" pill over the
grid that refetches on click. Anonymous streams are capped at 4 per IP.

**States**: loading (the grid's skeleton), empty with no rooms ("No parties right now" and Start a party, which creates
with the `public` preset), empty with filters ("Nothing matches these filters" and Clear filters), error with retry,
offline (the cached page and a banner), partial (live updates down: a quiet "Live updates paused", the page still works).

**Design**: slice 3 adds `docs/design/screens/web/parties.html` (the grid at every breakpoint, the filter sheet on
compact, each state) and `docs/design/apps/web/party-card.md` before the page is built.

**Abuse and moderation**: 60 list requests a minute per caller; the first page of each filter set cached 5 s for signed-out
callers (`followed` is per viewer, never cached). `POST .../reports` (one per reporter per room, or per member with
`target_key` and `context`); 3 open room reports from distinct accounts hide a room from discovery until a moderator
restores it; `POST /v1/admin/watch-parties/:id/close` and `.../restore` for MODERATOR and ADMIN. Names are 1 to 60
characters, no URLs, no control characters.

**SEO**: `/parties` is indexable with its own head (title, description, `index, follow`); every filtered variant's
canonical is `/parties`, so filter combinations never become thousands of thin pages. Party pages are `noindex` and not
in the sitemap (section 11).

### 13. Scheduled parties

- `scheduledFor` at create or edit (`room.schedule`), 5 minutes to 30 days ahead. The room is in `lobby` from creation;
  people can join early. "Interested" (`PUT` and `DELETE /v1/watch-parties/:id/interest`) for any account that can see
  the room.
- **Reminders**: `notify-party-reminder` is enqueued through the outbox as two delayed jobs, 10 minutes before and at the
  start, for the interested and the pending invitees (`party_starting`). The job id carries the scheduled instant, so a
  reschedule enqueues new ones and a job whose instant no longer matches the row does nothing; closing sends nothing.
- **Start**: with `auto_start` (default on for scheduled rooms) the room starts itself at `scheduled_for` if anyone is
  present; otherwise anyone holding `playback.control` starts it. An hour past with no start it closes as "didn't start".

### 14. Discord: what is 140's, 78's and 142's

140 builds the room engine and keeps it client-agnostic: anything with a seat can join, hold the socket and act within its
roles, and the principal model already has the Discord kind. It adds **no Discord code, no `DISCORD_*` key and no call to
Discord**; party links unfurl in Discord through the Open Graph tags (section 11), and the share dialog's Web Share
reaches the Discord app on phones. `make smoke-offline` is unaffected.

- [78](78-discord-integration-bot-watch-together-activity-creator-alerts.md) (edited in this PR to match): Discord party
  credentials (the Activity's verified identity and "Join with Discord" on the web preview), its Watch Together activity
  joining the 140 room mapped to the activity instance, its bot's `/party` command and "Watch together" buttons, and Rich
  Presence with the party size, all behind its Discord config and off by default.
- [142](142-discord-party-bridge.md): the chat bridge, live embeds with the roster, Scheduled Events and role
  mapping.

78 and 142 are blocked by 140, so there is one room design and one roster.

### 15. Permissions outside the room roles

Room actions are the room-scoped ability of section 2. What stays on the principal-level ability:

| Action | Who |
|---|---|
| `create` `WatchParty` | any signed-in account |
| `read` `WatchParty` (the preview) | anyone for public and unlisted; members and holders of a grant for private |
| `join` `WatchParty` | accounts and Discord members through section 4; guests only where `allowGuests` |
| `report` `WatchParty` | signed-in accounts, public rooms or rooms they are in |
| `close`, `restore` (admin) | MODERATOR, ADMIN |

A guest or Discord principal holds nothing else, on any subject.

`apps/client/web/e2e/security/privilege-escalation.test.ts` gains rows, each 403 for a signed-in non-member or a plain
member and 401 signed out: edit another owner's room, close it, assign a role, create a role, kick, ban, transfer
ownership, create and list invite links, remove someone else's queue item without `queue.remove`, and the admin close as
a normal user. A second table in the same spec seeds a room where the caller holds a custom role "Organizer" at position
450 with `roles.manage`, `roles.assign` and `chat.moderate`, and proves each anti-escalation rule refuses with 403:
creating or editing a role to include `room.close` (not held); editing, moving, deleting, assigning or revoking Moderator
(600, above them); moving Organizer to 650; assigning Moderator to themselves; muting in chat, kicking or banning a
Moderator; assigning Chat muted (520, above them) despite holding `chat.moderate`; assigning, revoking or editing Owner;
demoting the owner; deleting a built-in role; lifting their own Chat muted. A third table covers the built-in ladder: a
Moderator assigning Co-host, muting a Co-host or editing a role; a Co-host closing the room or editing a role; a DJ
assigning any role. A fourth covers guests: a guest credential posting, reacting, adding to the queue, sending a
playback command or inviting is refused; a guest credential on `/v1/me/account`, `/v1/me/notifications` and a
subscribe is 401; a guest whose seat has a role assignment inserted straight into the database is still refused every
permission outside the ceiling. Reading someone else's private room is 404 and asserted in the API spec, since the
table's statuses are 403 and 401.

### 16. Contracts

Everything in `@vp/api-contracts` and the committed OpenAPI document (`pnpm gen:contracts`), with SDD §6.1 rows and an
`apps/server/api/src/__tests__/sdd-watch-party-endpoints.ts` for the SDD contract check. New error codes, each with its
`PROBLEM_STATUS` and `RETRY_CLASS`: `WATCH_PARTY_NOT_FOUND` (404), `WATCH_PARTY_CLOSED` (410), `WATCH_PARTY_FULL` (409),
`WATCH_PARTY_BANNED` (403), `WATCH_PARTY_GUESTS_OFF` (403), `WATCH_PARTY_PASSWORD_REQUIRED` (403),
`WATCH_PARTY_PASSWORD_INVALID` (403), `WATCH_PARTY_PASSWORD_LOCKED` (429), `WATCH_PARTY_INVITE_INVALID` (403),
`WATCH_PARTY_LIMIT_REACHED` (409), `WATCH_PARTY_VIDEO_NOT_SHAREABLE` (422), `WATCH_PARTY_QUEUE_FULL` (409),
`WATCH_PARTY_STATE_STALE` (409, socket only), `WATCH_PARTY_PERMISSION_MISSING` (403, names the permission),
`WATCH_PARTY_ROLE_ESCALATION` (403), `WATCH_PARTY_ROLE_PROTECTED` (403), `WATCH_PARTY_ROLE_NOT_FOUND` (404),
`WATCH_PARTY_ROLE_LIMIT` (409), `WATCH_PARTY_SLOW_MODE` (429), `WATCH_PARTY_CHAT_OFF` (403),
`WATCH_PARTY_TICKET_INVALID` (401), `WATCH_PARTY_CREDENTIAL_INVALID` (401). Routes marked `partyGuest` below accept a
guest or Discord party credential as well as a session.

| Method and path | Purpose | Request | Response | Notes |
|---|---|---|---|---|
| `POST /v1/watch-parties` | Create a room | `{ name?, visibility, password?, capacity?, allowGuests?, preset: 'friends' \| 'public', chatEnabled?, slowModeSeconds?, bufferPolicy?, autoplay?, skipVotePercent?, idleClose?, language?, accent?, scheduledFor?, autoStart?, hostAs: 'user' \| 'channel', source?: { videoId, startMs? } \| { playlistId } \| { videoIds, startIndex? }, reuse? }` | `201 WatchParty` / `400` / `401` / `409 WATCH_PARTY_LIMIT_REACHED` / `422 WATCH_PARTY_VIDEO_NOT_SHAREABLE` / `429 RATE_LIMITED` | Accounts, 10 per hour. Writes the eleven built-in roles. `hostAs: 'channel'` needs a channel with a public ready video. |
| `GET /v1/watch-parties/:id` | Room preview | - | `200 WatchParty & { features: { voice }, roster: RosterPreview, viewer: { memberKey?, permissions, roleIds, canJoin, actions } }` / `404` | Anonymous, `partyGuest`. `canJoin` is `member`, `yes`, `password`, `full`, `banned`, `guests_off` or `closed`; `actions` lists which of guest, Discord and sign-in the preview offers. |
| `PATCH /v1/watch-parties/:id` | Edit settings | settings above plus `version`; `password: null` clears it | `200 WatchParty` / `403` / `404` / `409 VERSION_CONFLICT` / `422` | `room.edit`; `scheduledFor` and `autoStart` need `room.schedule`. A change is broadcast as `settings`. |
| `POST /v1/watch-parties/:id/close` | Close | `{ reason? }` | `200` / `403` / `404` | `room.close`. Sockets get `closed` and close. |
| `POST /v1/watch-parties/:id/guest` | Watch as guest | `{ invite? }` | `201 { membership }`, sets `vp.party-guest` / `403 WATCH_PARTY_GUESTS_OFF` / `404` / `409 WATCH_PARTY_FULL` / `429` | Anonymous; 5 credentials per IP per hour, 30 guest joins per room per minute. |
| `POST /v1/watch-parties/:id/seat/upgrade` | Upgrade a guest seat in place | - (the guest credential and the new session or Discord credential) | `200 { membership }` / `403 WATCH_PARTY_BANNED` / `404` | `partyGuest`; the socket stays open and gets `you`. |
| `POST /v1/watch-parties/:id/join` | Join | `{ password?, invite? }` (invite id or link token) | `200 { membership }` / `403` (password required or invalid, banned, invalid invite) / `404` / `409 WATCH_PARTY_FULL` / `410` / `429 WATCH_PARTY_PASSWORD_LOCKED` | `partyGuest` (Discord members). Idempotent for a member. |
| `POST /v1/watch-parties/:id/leave` | Leave | - | `204` | `partyGuest`. The owner leaving starts the grace (section 5). |
| `POST /v1/watch-parties/:id/socket-ticket` | Socket ticket | - | `201 { ticket, expiresAt }` / `403` / `404` | `partyGuest`; members only, 30 s, one-time. |
| `GET /v1/watch-parties/:id/socket?ticket=&after=` (WebSocket) | Room socket | client frames below | `101` then server frames / `401 WATCH_PARTY_TICKET_INVALID` / `403` / `404` / `409 WATCH_PARTY_FULL` | Refusals are Problems before the upgrade; hidden from the OpenAPI document like 76's. |
| `GET /v1/watch-parties/:id/roster` | Roster | - | `200 { entries: RosterEntry[], guests }` for members, `200 RosterPreview` for anyone else who can read the room | `partyGuest`; section 3's projection. |
| `GET /v1/watch-parties/:id/roles` | Roles | - | `200 { items: [{ id, key, kind, name, colour, position, permissions, memberCount, updatedAt }], rolesVersion, permissionsVersion }` | Members, `partyGuest`. |
| `POST /v1/watch-parties/:id/roles` | Create a role | `{ name, colour?, kind?, position?, permissions }` | `201 Role` / `403 WATCH_PARTY_ROLE_ESCALATION` / `409 WATCH_PARTY_ROLE_LIMIT` / `422` | `roles.manage`, section 2's rules. |
| `PATCH /v1/watch-parties/:id/roles/:roleId` | Edit a role | `{ name?, colour?, position?, permissions?, updatedAt }` | `200 Role` / `403` / `404 WATCH_PARTY_ROLE_NOT_FOUND` / `409 VERSION_CONFLICT` | `roles.manage`; the Owner role refuses everything but name and colour, and those only from the owner; Guest refuses anything outside its ceiling. |
| `DELETE /v1/watch-parties/:id/roles/:roleId` | Delete a role | - | `204` / `403 WATCH_PARTY_ROLE_PROTECTED` / `404` | `roles.manage`, custom roles only; holders lose it. |
| `POST /v1/watch-parties/:id/roles/preset` | Apply a preset | `{ preset }` | `200 { items }` | `roles.manage`; resets every built-in role but Owner. |
| `PUT /v1/watch-parties/:id/members/:memberKey/roles/:roleId` | Assign a role | `{ expiresIn?: '10m' \| '1h' \| 'party' }` | `204` / `403` / `404` | `roles.assign` (`chat.moderate` for Chat muted, `voice.moderate` for Voice muted), below the caller's position, on a non-guest member below it; `expiresIn` for the mutes only. |
| `DELETE /v1/watch-parties/:id/members/:memberKey/roles/:roleId` | Revoke a role | - | `204` / `403` / `404` | Same rules; anyone may drop a `grant` role they hold themselves, except Owner. |
| `POST /v1/watch-parties/:id/members/:memberKey/kick` | Kick | - | `204` / `403` | `members.kick`, hierarchy; the socket gets `kicked`. |
| `POST /v1/watch-parties/:id/guests/remove` | Remove all guests | - | `204` / `403` | `members.kick`; every guest socket gets `kicked`. |
| `PUT` and `DELETE /v1/watch-parties/:id/bans/:memberKey` | Ban, unban | `{ reason? }` | `204` / `403` | `members.ban`, hierarchy; a guest ban also stores the IP hash. |
| `POST /v1/watch-parties/:id/owner` | Transfer ownership | `{ memberKey }` | `200` / `403` / `404` | The owner only; the target must be a non-guest member; the old owner holds Co-host. |
| `GET /v1/watch-parties/:id/queue` | Queue | - | `200 { items, version }` | Members, `partyGuest`. |
| `POST /v1/watch-parties/:id/queue` | Add | `{ videoId, startMs? } \| { playlistId }` | `201` / `403` / `409 WATCH_PARTY_QUEUE_FULL` / `422 WATCH_PARTY_VIDEO_NOT_SHAREABLE` | `queue.add`, `partyGuest`. |
| `PATCH /v1/watch-parties/:id/queue/:itemId` | Move | `{ toIndex }` | `200` / `403` | `queue.reorder`, `partyGuest`. |
| `DELETE /v1/watch-parties/:id/queue/:itemId` | Remove | - | `204` / `403` | `queue.remove`, or `queue.add` for one's own pending item; `partyGuest`. |
| `POST /v1/watch-parties/:id/invites` | Invite | `{ userIds }` (1 to 20) | `201 { sent, folded, refused: [{ userId }] }` / `403` / `429` | `members.invite`, accounts. |
| `GET /v1/watch-parties/:id/invites` | Pending and joined invites | - | `200 { items }` | `members.invite`. |
| `DELETE /v1/watch-parties/:id/invites/:inviteId` | Revoke | - | `204` | `members.invite`. |
| `POST /v1/me/watch-party-invites/:inviteId/decline` | Decline | - | `204` / `404` | The invitee; marks its notification read. |
| `POST /v1/watch-parties/:id/invite-links` | Invite link | `{ ttl, maxUses? }` | `201 { id, token, url, expiresAt }` | `members.invite`, `partyGuest`; the token is shown once. |
| `GET /v1/watch-parties/:id/invite-links` | Links | - | `200 { items }` (no tokens) | `members.invite`. |
| `DELETE /v1/watch-parties/:id/invite-links/:linkId` | Revoke a link | - | `204` | `members.invite`. |
| `GET /v1/watch-parties/:id/invite-candidates?q=` | People to invite | - | `200 { items: [{ userId, handle, displayName, avatarUrl, reason, inRoom, invited }] }` | `members.invite`, accounts. |
| `GET` and `PUT /v1/me/watch-party-controls` | Personal controls | `PUT { targetKey, roomId \| null, voiceMuted?, volume?, hideMessages?, hideReactions?, hideAvatar?, hideRequests?, blockInvites?, favourite? }` (all false deletes the row) | `200 { items }` / `401` / `422` | Accounts only; `roomId` scopes it; emits `party.controls.updated`. |
| `GET /v1/watch-parties?…` | Discovery | section 12 | `200 { items: WatchPartyCard[], nextCursor }` / `400 INVALID_CURSOR` / `429` | Anonymous. |
| `GET /v1/watch-parties/events` | Discovery stream (SSE) | - | `party.counts`, `party.opened`, `party.updated`, `party.closed` | Anonymous, 4 per IP. |
| `GET /v1/me/watch-parties` | My rooms | - | `200 { owning, joined, interested }` | Open rooms only. |
| `PUT` and `DELETE /v1/watch-parties/:id/interest` | Interested | - | `204` | Scheduled rooms, accounts. |
| `POST /v1/watch-parties/:id/reports` | Report | `{ targetKey?, context?, reason, details? }` | `201` / `409` (already reported) | Accounts. |
| `POST /v1/admin/watch-parties/:id/close` and `.../restore` | Moderate | `{ reason }` | `200` / `403` | MODERATOR, ADMIN. |

**Socket frames** (`watch-party-socket.ts`, one discriminated union each way, every client frame with an optional `ref`):

| Client sends | Server sends |
|---|---|
| `clock { t0 }` | `hello { room, roles, rolesVersion, you: { memberKey, kind, roleIds }, playback, version, serverNow, queue, roster, chat: { resume, mode, pinned } }` |
| `play`, `pause`, `seek`, `rate`, `next`, `start` (each `{ version, … }`) | `clock { t0, serverNow }` |
| `ended { itemId, version }` | `state { playback, version, by, reason }` |
| `ready { ready }`, `buffering { buffering }`, `away { away }` | `countdown { startsAt }` |
| `skipVote { itemId }` | `queue { items, version }`, `votes { itemId, votes, needed }` |
| `request { kind, positionMs? }` | `request { from, kind, positionMs? }` (to `playback.control` holders only) |
| `chat.send { message }`, `chat.remove { id }`, `chat.pin { id \| null }` | `chat.message`, `chat.removed`, `chat.pinned`, `chat.mode` |
| `react { emoji }` | `reactions { counts, from }` |
| `stats { driftMs, hardSeeks }` | `roster.patch { upserts, removals, guests }`, `settings { … }` |
| | `roles { roles, rolesVersion }`, `member.roles { memberKey, roleIds, expiries, rolesVersion }`, `owner { userId, rolesVersion }`, `you { memberKey, kind, roleIds }` (after a seat upgrade) |
| | `ack { ref }`, `error { ref, problem }`, `kicked`, `closed { reason }`, `superseded` |

### 17. Observability

| Metric | Type | Labels | Source |
|---|---|---|---|
| `watch_party_rooms` | gauge | `phase` | API poller (SQL) |
| `watch_party_present_members` | gauge | `kind` (user, discord, guest) | API poller |
| `watch_party_sockets` | gauge | - | API, per pod |
| `watch_party_joins_total` | counter | `kind`, `outcome` (joined, full, guests_off, password_required, password_invalid, locked, banned, closed, not_found) | API |
| `watch_party_seat_upgrades_total` | counter | `to` (user, discord) | API |
| `watch_party_commands_total` | counter | `command`, `result` (applied, stale, forbidden, refused) | API |
| `watch_party_permission_denials_total` | counter | `permission`, `kind` | API |
| `watch_party_role_changes_total` | counter | `action` (create, update, delete, assign, revoke, preset, transfer), `result` (applied, escalation) | API |
| `watch_party_drift_seconds` | histogram | - | API, from `stats` frames (absolute drift; buckets 0.05 to 5 s) |
| `watch_party_hard_seeks_total` | counter | - | API, from `stats` frames |
| `watch_party_fanout_seconds` | histogram | - | API: publish time in the broadcast to the write on each pod |
| `watch_party_chat_messages_total` | counter | `source`, `outcome` (sent, refused) | API |
| `watch_party_invites_total` | counter | `outcome` (sent, folded, refused) | API |
| `watch_party_clock_skew_seconds` | gauge | - | API poller (pod clock minus Postgres `clock_timestamp()`) |

- **Traces**: `watch_party.join`, `watch_party.command`, `watch_party.roles` and `watch_party.seat_upgrade` spans (room
  id, action, result, versions) around the CAS and the publish; REST routes are covered by the existing instrumentation.
- **Logs**: one line per create, close, ownership transfer, seat upgrade, role change and moderation action with room
  and actor keys; refused joins and denials count in the metrics, not one log line each. The pino redaction paths gain
  `password`, `invite`, `token`, `ticket` and the party credential header. Personal controls are never logged.
- **Dashboard** `infra/observability/dashboards/watch-parties.json` (rooms, present by kind, sockets per pod, joins by
  outcome, drift p50 and p95, fan-out p95, commands by result, denials by permission, escalation attempts, chat rate,
  skew), copied into the k8s dashboards config map.
- **Alerts** in `infra/observability/alerts/video-pipeline-alerts.yaml`, each with a runbook under `docs/runbooks/`:
  `WatchPartyDriftHigh` (drift p95 over 1 s for 10 min, warning), `WatchPartyFanoutSlow` (fan-out p95 over 250 ms for
  10 min, warning), `WatchPartyPasswordBruteForce` (password failures over 1 per second for 5 min, warning),
  `WatchPartyGuestFlood` (guest joins over 10 per second for 5 min, warning), `WatchPartyClockSkew` (absolute skew over
  100 ms for 5 min, warning).

### 18. Load and abuse

- **S8 `tests/load/s8-watch-parties.js`** (k6 `k6/websockets`): 200 rooms of 25 members (5 000 sockets, a fifth of them
  guests) over 2 API replicas, plus one room at the ceiling (200 members). Each member pings the clock every 30 s, chats
  about every 30 s and reacts in bursts; one controller per room sends a command every 20 s, and one role change per room
  per minute flips `playback.control` on Member. Pass: command to every member's `state` p95 under 250 ms, role change to
  every member's `roles` frame p95 under 250 ms, fan-out p95 under 150 ms, socket errors under 0.1 %, API RSS under 768 MB
  per pod, no `superseded` or `kicked` frames that the script did not cause. A row in SDD §14.2 and results under
  `docs/load-tests/results/`.
- **Abuse, as specs**: the 6th wrong password in 15 minutes is `WATCH_PARTY_PASSWORD_LOCKED` with `Retry-After`, per
  member key and per IP across keys; the 6th guest credential from one IP in an hour and the 31st guest join in a room in
  a minute are `429`; a banned guest is refused again from the same IP with a new credential; the 31st invite in an hour
  is `RATE_LIMITED`; the 6th chat line in 10 s and a line inside slow mode are refused with the retry time; the 7th
  command in 5 s is refused; the 11th room created in an hour and the 4th open room are refused; the 26th role in a room
  is `WATCH_PARTY_ROLE_LIMIT`; the 61st discovery request in a minute is `429`; a 5th anonymous discovery stream from one
  IP is refused; a second socket for the same member supersedes the first; frames over 4 KB and unknown frame types are
  `error` frames, never a crash.

### And beyond: where every other idea goes

Marks: **140** is this ticket, **141** voice, **142** the Discord bridge, **143** watch party extras, **skip** with the
reason.

| Area | Idea | Where |
|---|---|---|
| Room | Lobby with ready check and a 3 s start countdown | 140 |
| Room | Roles: the eleven built-ins, custom roles, colours, positions, presets, scoped timed mutes | 140 |
| Room | Guests, Discord members and seat upgrades in place | 140 (guests), 78 (Discord credentials) |
| Room | The unified roster with source, roles, sync, voice and away, and its outside projection | 140 |
| Room | Personal controls per member, room or everywhere | 140 (voice parts applied by 141) |
| Room | Reaction overlay with synced emoji, reduced-motion chips | 140 |
| Room | Start at a timestamp; a party from a clip | 140 |
| Room | Scheduled parties with "Interested" and reminders | 140 |
| Room | Requests to seek, skip or start, vote to skip | 140 |
| Room | Pinned chat line, timestamp chips, system lines, role badges | 140 |
| Room | Room accent, per-viewer layout | 140 |
| Room | QR code, Web Share, invite links with expiry and uses | 140 |
| Room | Persistent named rooms (`idle_close = never`) | 140 |
| Room | Reports per room or member, auto-hide, moderator close | 140 |
| Voice | Group voice on a self-hosted SFU, push-to-talk or open mic, speaking rings, per-user volume, ducking | 141 |
| Voice | Live captions of voice | skip for now: needs streaming speech-to-text, which 111 left out; revisit after 141 |
| Discord | Activity sync with web members in one room | 78 (already one room socket) |
| Discord | Join with Discord on the web preview, no account | 78 |
| Discord | `/party` with a live embed of the roster and now playing | 78 (command), 142 (live embed) |
| Discord | Chat bridge both ways with source badges and moderation | 142 |
| Discord | Voice bridge between a Discord voice channel and 141's voice | skip: Discord documents voice receive as unsupported, a relaying bot breaks DAVE's end-to-end encryption, and it needs consent from everyone in the channel; Discord members talk through the Activity, app members through 141 |
| Discord | Scheduled parties as Discord Scheduled Events | 142 |
| Discord | Discord server roles mapped to room roles | 142 |
| Discord | Rich Presence "Ask to join" | skip: join requests belong to Discord's native game SDKs, not to a web app or an Activity; the Activity's own Join button is 78's |
| Play | Flying timed comments (danmaku), opt-in overlay, replayed on the video later | 143 |
| Play | Reaction bursts and confetti on big moments | 143 |
| Play | Polls and "predict what happens next" | 143 |
| Play | Vote for the next video from 3 suggestions; queue roulette | 143 |
| Play | Lobby trivia and mini-games while waiting | 143 |
| Play | Soundboard, role-gated (its own permission) and rate-limited | 143 |
| Play | "Instant replay" vote to rewind 10 s together | 143 |
| Play | Karaoke mode: large captions (111) for music videos | 143 |
| Play | Theater seat row of avatars with their live reactions | 143 |
| Play | Telestrator: draw on the paused frame | 143 |
| Play | Watch bingo cards generated from the video's chapters and tags | 143 |
| Play | Countdown-synced "3, 2, 1, react" moments a host can trigger | 143 |
| Memory | Party history, chat replayed against the video, a reaction heatmap on the timeline | 143 |
| Memory | Party recap card (time watched, top reactor, most-reacted moment), shareable | 143 |
| Memory | Rewatch with the same group (recreate a past party and invite everyone) | 143 |
| Memory | Badges and achievements for hosting and attending | 143 |
| Social | Friends watching now (on home and in the rail) | 143, from subscriptions and recent co-watchers until a people graph exists |
| Social | Follow a host; "notify me when X hosts" | 143 |
| Social | A people graph (follow a person, friends) | skip here: a platform feature far bigger than parties; its own ticket when the product wants one |
| Social | Watch-party invites to a closed browser | skip here: Web Push is 99's follow-up |
| Creator | Creator premieres with a countdown and the creator as Owner; live broadcasts in a room | 143 |
| Creator | Creator watch-alongs (a creator hosts a room over someone's video, their commentary in voice) | 143, on 141 |
| Creator | Sponsored or featured rooms | skip: there is no ads or sponsorship system to sell or label them |
| Creator | Party views and reach in studio analytics | 143 |
| Integrations | Clip a moment during the party (105) and drop it in chat | 143 |
| Integrations | Transcript jump: search the transcript (111) and seek the room | 143 |
| Integrations | Save the party queue as a playlist | 143 |
| Integrations | "Start a party" from a channel page and a search result | 143 |
| Integrations | Rooms in global search | 143, once rooms prove long-lived enough to be worth a result |
| Integrations | Party in the now playing bar while browsing, and picture-in-picture | 143 |
| Integrations | Role templates saved and reused across one's rooms | 143 |
| Mobile and TV | A phone as the remote for a TV or laptop tab | 143 |
| Mobile and TV | Cast to a TV | skip: Chromecast's sender SDK loads from Google's servers, which breaks local-first; AirPlay works today through the native video element |
| Accessibility | Reduced-motion reactions | 140 |
| Accessibility | Screen-reader announcements of playback changes and requests | 140 |
| Accessibility | Captions shown for everyone in the room's chosen language, overridable per viewer | 143 |
| Safety | Room word filter and link blocking in chat | 143, reusing 113's blocked words once it lands |
| Safety | A reported-rooms and reported-members queue in the admin panel ([61](61-admin-control-panel-category-moderation-ui.md)) | 143 |
| Safety | Raid protection: a host toggle that turns guests off and slow mode on in one click | 143 |
| Safety | Account-age and verified-only joins for public rooms | 143 |

## Delivery

One stack, `feat/140-watch-parties`, three slices (`slice/140a-…` to `slice/140c-…`), each green on its own:

1. **140a: Rooms, roles and identities engine.** Tables and migration, domain (the permission registry, built-in roles,
   presets, `effectivePermissions`, `upgradeRoomRoles`, principals, the roster and its projection), validation,
   decisions, the room-scoped ability and its rules, error codes, ports and both adapter families (gate, presence, party
   credentials, hasher, repositories), the `partyGuest` contract flag and the auth plugin's handling, the `pattern-hub.ts`
   extraction under `LiveChatHub`, every REST endpoint of section 16 except discovery, the room socket with the clock,
   commands, drift reporting, buffering, owner grace, roster and role frames, seat upgrades, chat, reactions, requests and
   votes, personal controls (table, endpoint, event), the notification kinds and the invite job, the sweep, the env keys
   and tuning, the backend metrics and logs, the `privilege-escalation.test.ts` tables, SDD (§5, §6.1, §6.2, §10.4, a new
   §10.7 Watch parties, §16, ADR-27's line, ADR-31), ARCHITECTURE and CONTEXT.
2. **140b: The party page, roles, roster and every way in.** Design screens and component docs first, then the kit
   (`PartyRoom`, `Roster`, `RoleEditor`, `ReactionOverlay`, `NotificationCentre.ItemAction`, the `party` icon), the
   room-scoped `<Can>` provider, the player port's `buffering` and `ended`, the client socket, clock and drift driver in
   `@vp/queries`, the party page in every phase and state, the preview with its three actions and the guest seat, the role
   editor, the member menu with moderation and personal controls, chat badges, `/settings/party-controls`, the per-viewer
   `party` preferences section, the room accent, the share dialog with QR and Web Share, the invite picker and the two
   invite settings, the entry points of section 10, the invite row and toast in the bell, the party page head, copy in
   `en` and `pl`, and the two-browser e2e.
3. **140c: Discovery, schedules and the hand-off.** The discovery design screen and `PartyCard`, the discovery endpoint,
   scope, search and SSE stream, the `/parties` page with its filters, cards, states and nav entries, scheduled parties
   with interest and reminders, reports and the moderator close, the dashboard, alerts and runbooks, S8 and its results,
   the 78 hand-off check, and the ticket set to `done`.

## Acceptance criteria

### 140a: Rooms, roles and identities engine

- [ ] Two members on two API instances sharing one cache: a `pause` from one reaches the other as `state` with the new
      version, and a command carrying an old version gets `WATCH_PARTY_STATE_STALE` with the current state.
- [ ] The clock spec: expected position for playing, paused and rate changes; the offset filter picks the lowest
      round-trip of 8 samples; the drift table (ignore, nudge, seek with cooldown) as one `it.each`.
- [ ] **Each permission is enforced on the server**: one `it.each` over `WATCH_PARTY_PERMISSIONS` runs the action each
      entry guards (REST or socket) as a member without it, getting `WATCH_PARTY_PERMISSION_MISSING` naming it (or the
      403 Problem for REST), and with it, succeeding; an entry with no case fails the spec unless it is in
      `PENDING_ENFORCEMENT` (the three `voice.*` entries, for 141).
- [ ] The built-in roles: one `it.each` per role checks its position, kind and default permissions as section 2's
      table; none can be deleted; each can be renamed, recoloured and edited, except Owner's permissions and Guest past
      its ceiling.
- [ ] Presets: a `friends` room's Member can play, pause, add, reorder, remove and skip; a `public` room's Member can only
      chat, react, vote, request and listen; both are editable afterwards, and applying a preset again resets every
      built-in role but Owner and nothing else.
- [ ] `effectivePermissions` as a table: Member only; Member plus a grant role; Chat muted removing chat but not voice;
      Voice muted removing voice but not chat; both at once with different expiries, each lifting on its own; Spectator
      removing everything; an expired mute ignored; the owner holding everything and never restricted; a guest clamped to
      the ceiling with a forged assignment present.
- [ ] Extending the registry: a fixture that adds a permission at version 2 upgrades a version-1 room on load (built-in
      roles per their defaults, custom roles without it), writes `permissions_version = 2`, and needs no migration.
- [ ] **Anti-escalation**, each refused with `WATCH_PARTY_ROLE_ESCALATION` (or `WATCH_PARTY_ROLE_PROTECTED`) and each a
      row in `privilege-escalation.test.ts` (section 15's tables): granting a permission one lacks; editing, moving,
      deleting, assigning or revoking a role at or above one's position; moving a role to or above it; kicking, banning,
      muting or changing the roles of a member at or above it; assigning, revoking or editing Owner; demoting the owner;
      deleting a built-in role; lifting one's own mute; assigning any role to a guest; a Moderator assigning Co-host; a
      Co-host closing the room or editing roles. A platform MODERATOR can kick, ban, mute and close in any room and cannot
      touch roles.
- [ ] **Guests**: with "Allow guests" on, a guest watches in sync from a pasted link with no account; every chat, reaction,
      queue, playback, invite and role attempt by a guest is refused on the server; with it off, the guest join is
      `WATCH_PARTY_GUESTS_OFF`; guests count toward capacity; removing one guest and removing all guests both work; a
      banned guest is refused from the same IP with a new credential.
- [ ] **Seat upgrade**: a guest signing in mid-party keeps the same socket and playback position, gets `you` with the
      new member key and Member's permissions, and can chat at once; a guest ban carries to the new key.
- [ ] **Party credentials stay in parties**: a guest credential on `/v1/me/account`, `/v1/me/notifications`, a subscribe and
      every other route without `partyGuest` is 401; the architecture check rejects `partyGuest: true` outside the
      watch-party contracts.
- [ ] Member keys: a ban on `discord:<id>` (seeded through the port) refuses that key on the REST join and on the socket,
      whatever path issued the credential.
- [ ] Ownership: only the owner transfers it, the target becomes owner and the previous owner holds Co-host; the
      owner's socket closing keeps ownership for 60 s, a reconnect inside it keeps it, and after it the present non-guest
      member with the highest position becomes owner with an `owner` frame and a system line; with the transferring pod
      killed, the sweep transfers within a minute.
- [ ] **Live role changes**: revoking `playback.control` from Member reaches every socket as `roles` within one
      broadcast; a `pause` the member sent with the pre-revoke versions is refused as stale and then as
      `WATCH_PARTY_PERMISSION_MISSING`; muting a member in chat on pod A refuses their next chat line on pod B; a Chat
      muted with a 10-minute expiry stops applying at 10 minutes with no job having run.
- [ ] Roster: joins, leaves, ready, sync, away and role changes reach every socket as `roster.patch` within 500 ms,
      batched; guests arrive as a count for members without `members.kick` and as entries for those with it; the preview
      projection shows at most 5 faces, only of accounts with `showInParties` on, counts Discord members and guests by
      source, and shows no faces for a private room.
- [ ] **Personal controls**: a room-scoped control is returned only for that room; an everywhere control is returned for
      every room and reaches another signed-in device as `party.controls.updated`; `block_invites` makes an invite from
      that member `refused` without a reason; nothing about a control is ever sent to its target's socket or visible in
      any response to them.
- [ ] Buffering: with `wait` and 12 or fewer present, a member buffering 1.5 s pauses the room with `reason: buffering`
      and it resumes when nobody buffers or after 10 s; with 13 present, or `continue`, it never pauses.
- [ ] Capacity, each case a spec:
  - [ ] no capacity set: joins are admitted up to `WATCH_PARTY_MAX_MEMBERS` and the next is `WATCH_PARTY_FULL`;
  - [ ] capacity 10 with 10 present: an 11th member is refused, a guest is refused, an invitee is refused, an
        invite-link holder is refused, a Moderator or VIP (`members.joinWhenFull`) is admitted, and the owner is admitted
        even at the ceiling;
  - [ ] the owner, moderators and guests count toward the number shown;
  - [ ] lowering capacity from 12 to 10 with 12 present kicks nobody, refuses the next join, and admits again once
        present is 9;
  - [ ] two pods admitting the last spot at once admit exactly one (the Redis script, under the contract suite);
  - [ ] the ceiling comes from `WATCH_PARTY_MAX_MEMBERS` in `env-schema`, mirrored in `.env.example` (default 200), and a
        capacity above it is `VALIDATION_FAILED`.
- [ ] Passwords: a wrong one is `WATCH_PARTY_PASSWORD_INVALID`; the 6th failure in 15 minutes is
      `WATCH_PARTY_PASSWORD_LOCKED` with `Retry-After`, per member key and per IP; a valid invite or invite link joins
      without it; the stored value is an `scrypt$` string and the hasher spec passes under `pnpm test:bun`.
- [ ] A private room is 404 to a non-member without a grant; a revoked or expired invite link joins nobody and removes no
      member; a banned member is refused with every grant.
- [ ] A queued video that turns private is removed with a system line and the room skips within a minute; a private
      video is `WATCH_PARTY_VIDEO_NOT_SHAREABLE` everywhere, and an unlisted one is refused in a public room only.
- [ ] Queue: the 4th pending add by a member with `queue.add` alone is refused; skip votes reaching the threshold advance;
      `ended` near the end advances with `autoplay` and is ignored 10 s early.
- [ ] Chat: a line is stored before it is published and a reconnect with `?after=` replays exactly what was missed;
      slow mode (and its bypass), chat off, remove and pin behave as section 6; reactions from 200 members inside 250 ms
      reach each socket as at most one `reactions` frame per pod.
- [ ] An invite creates one `party_invite` notification through the outbox (none on rollback) with its `watching`
      snapshot, folds a second inviter into the same row, respects `watchParties` and each `watchPartyInvites` value, and
      emits 98's `notification.created`.
- [ ] Rooms close per `idle_close`, `never` stays open, and messages, rows, room-scoped controls and guest ban hashes are
      purged on schedule.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm boundaries`,
      `pnpm gen:contracts` (no diff) green, with output in the PR.

### 140b: The party page, roles, roster and every way in

- [ ] From the watch page, "Watch together" then Copy puts a working room link on the clipboard in two clicks, and the
      same works from the player (also in fullscreen), the queue, a playlist, a clip and a card menu; signed out, each
      opens sign-in.
- [ ] A signed-out visitor on a party URL sees the preview with "Watch as guest" and "Sign in", plus "Join with Discord"
      only when 78's integration is configured; "Watch as guest" plays in sync, and "Sign in" from inside the room
      upgrades the seat with no reload and no jump in playback.
- [ ] Two browsers in one room (Playwright, two contexts): play, pause, seek and rate from one reach the other within
      500 ms, and the follower's measured drift settles under 250 ms within 10 s of a seek.
- [ ] A late joiner starts at the room's position; a refused unmuted autoplay plays muted with "Tap for sound".
- [ ] The lobby shows who is ready and Start runs a countdown both browsers see before playback starts.
- [ ] Role editor: creating a role, giving it `queue.add` and assigning it to the second browser's member makes the add
      control appear there without a reload; revoking it removes the control; rows and permissions the editor may not
      touch render disabled with their reason; Guest offers nothing past its ceiling; each role's colour shows on its
      badges in the roster and chat.
- [ ] The member menu offers only the moderation the viewer's ability allows on that member; "Mute in chat" and "Mute in
      voice" are separate items, and muting in chat shows the muted state with its end time in the target's composer at
      once while their voice items stay.
- [ ] Personal controls: hiding a member's messages makes their lines render as hidden for the viewer only (the second
      browser still sees them, and the target sees no change); "Show anyway" reveals one; a room-only mute does not
      follow the viewer into another room; an everywhere mute does, and on another signed-in device too; the undo mark
      clears it in one click; `/settings/party-controls` lists and removes everywhere entries; a guest's room-only
      controls survive a reload.
- [ ] The invite row: clicking anywhere on it joins the room (skipping the password) and shows its `watching` line;
      Decline removes the CTA, marks it read and notifies nobody; an expired invite shows "Ended"; the two invite settings
      save and apply.
- [ ] The full panel shows on the room page and from an invite (which stays actionable), and enables Join when a spot
      opens.
- [ ] Layout changes (side, below, theater, focus, overlays, system lines) persist through 97 and load with no layout
      shift (CLS under 0.05).
- [ ] A room accent recolours the room's accent roles only, and a viewer with their own accent keeps theirs.
- [ ] A public room's page carries Open Graph tags with its name and thumbnail, a private room's carries none of either,
      and every party page is `noindex`.
- [ ] Every party surface has every state of section 11 as a story, and meets the polish bar
      ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) including compact portrait and landscape.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @vp/web test`, `pnpm test:architecture` green, with
      output in the PR.

**Decided while building the party page (140b core):**

- "Join with Discord" stays out of the preview until 78's integration owns its handler; the panel renders the button only when a handler is passed.
- A signed-in guest's "Sign in to chat" upgrades the seat in place; a signed-out guest goes to `/login` and back to the room.
- The player refusing unmuted autoplay is detected as still paused one check after `play`; the driver then mutes, plays and offers "Tap for sound".
- Compact keeps the same Chat, People, Queue tabs as the larger layouts; the room controls are a bar under the stage until the player's own control bar speaks to the room.

### 140c: Discovery, schedules and the hand-off

- [ ] `/parties` is in the rail after Live, in the You hub on compact and in the command palette, and its filters
      round-trip through the URL: a copied filtered URL opens the same view, and a bad value falls back to its default.
- [ ] Each filter, one row of a table spec over seeded rooms: `q` (by room name, by owner handle, by current video title,
      and a typo through the trigram fallback), `status` (`now`, `lobby`, `scheduled`), `category`, `language`, `access`
      (`open`, `password`), `size` (`small`, `medium`, `large`), `space`, `followed` (and ignored signed out), `creator`,
      `kind` (`single`, `playlist`).
- [ ] Each sort walks its keyset to the end with no gap, a cursor from another sort is `INVALID_CURSOR`, and the client
      drops a repeated id.
- [ ] `space=true` leaves full rooms out; without it a full card shows "Full" and opens the full panel.
- [ ] Private, unlisted, closed, hidden, 3-times-reported and banned-from rooms, and rooms playing a non-public video,
      never appear.
- [ ] Cards show the roster preview under section 3's rules; with the page open, a join elsewhere updates the card's
      count within 3 s, a closed room turns "Ended" in place, and a new matching room raises the "new parties" pill with
      no layout shift.
- [ ] A room started from `/parties` uses the `public` preset.
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

- Voice (141), the Discord chat bridge (142) and everything marked 143 or skip above.
- Camera.
- A platform-wide user block (none exists); channel bans from [113](113-channel-comment-moderation.md) applying to a
  room hosted as a channel belong to 113 or 143's safety work once it lands.
- Anything that calls Discord (78, 142).
- Studio changes: party members' views and watch history count as each member's own playback, unchanged; a guest's or
  Discord member's playback counts as an anonymous view.

## Testing plan

- **Pure**: the clock, drift, capacity, `effectivePermissions`, `upgradeRoomRoles`, the roster projection, personal
  control resolution and every `decide*` as `it.each` tables in `@vp/domain` and `@vp/domain-rules`, under vitest and
  `bun test`; the room-scoped ability as a table over the permission registry, the hierarchy and the guest ceiling in
  `helpers/__tests__/watch-parties.test.ts`.
- **Ports**: contract suites for `WatchPartyGatePort`, `WatchPartyPresencePort` and `PartyGuestSessionsPort` over the
  in-memory and Redis adapters (the atomic admit under concurrency), `PasswordHasherPort` over scrypt.
- **Repositories**: each Postgres repository against PGlite (CAS on `playback_version` and `roles_version`, roles with
  their permissions and assignments by member key, the seat re-key, personal controls by scope, the list scope, the
  keysets, search with the fallback), each with its in-memory twin.
- **API**: routes through the in-memory app; the socket with two app instances over one cache for fan-out, live role
  changes and seat upgrades, owner grace with fake timers, buffering, supersede, every refusal before the upgrade; the
  per-permission enforcement table; the `partyGuest` boundary.
- **Worker**: the invite and reminder jobs (rollback, folding, the stale reminder).
- **API**: the sweep (idle close, owner hand-over, purge, gauges) on a `Poller`.
- **Web**: component specs through the suite's single render helper; the socket hook against a fake socket; the drift
  driver against a fake `PlayerCommands`; the role editor's disabled states from the ability; personal controls filtering
  in the chat and roster; route specs for `/parties` search params.
- **E2E**: two browser contexts for sync, live role changes, a guest watching and upgrading in place, personal controls
  seen from both sides, the invite flow from the bell, the password and full panels, discovery live updates;
  `privilege-escalation.test.ts` with its four tables.
- **Load**: S8.

## Open questions

None.

- Decided: anyone can join and watch without an account as a guest, who never types, reacts, speaks or acts; the preview
  offers "Watch as guest", "Join with Discord" (only when configured) and "Sign in"; signing in or joining with Discord
  upgrades the seat in place; "Allow guests" is per room, on for public and unlisted rooms and off for private ones.
- Decided: guests are a built-in Guest role at the bottom with a hard ceiling of `voice.join`, enforced after every role
  and every database row, and never assignable roles; nicknames are generated, never chosen.
- Decided: people from Discord need no Taitube account; they are Discord members keyed by their Discord id, with roles,
  bans, budgets and personal-control targets on that key everywhere they arrive; linking an account carries roles over
  and copies bans; only id, name and avatar are stored.
- Decided: party credentials (guest and Discord) are opaque Redis-backed tokens accepted only on `partyGuest` routes.
- Decided: invites are open to everyone by default, inside the per-user and per-room limits; each user narrows it in
  notification settings (`watchPartyInvites`: everyone, subscriptions, nobody).
- Decided: discovery on compact is a row in the You hub plus the command palette, since the tab bar is full.
- Decided: room permissions are roles, not fixed control modes: a closed versioned registry, eleven built-in roles (Owner,
  Co-host, Moderator, Chat muted, Voice muted, Spectator, DJ, Speaker, VIP, Member, Guest), custom roles with positions
  and colours, grant and restrict kinds, enforced through a room-scoped CASL ability on every REST and socket action.
- Decided: Co-host gets everything but `roles.manage` and `room.close`, because closing ends everyone's party and editing
  roles reshapes the room; the owner can grant either.
- Decided: muting is scoped: Chat muted and Voice muted are separate restrict roles with their own expiries, offered as
  separate menu items; a user's own microphone mute is a client toggle, not a role.
- Decided: the voice permissions and roles live in 140's registry from the start, so 141 only adds enforcement.
- Decided: nobody grants what they lack or touches a role or member at or above their own position; ownership moves only
  by transfer, to a non-guest member; rooms created in the app are owned by an account, rooms the Activity creates may
  be owned by a Discord member.
- Decided: the `friends` preset (Member gets playback, queue, chat, reactions, votes, invites and voice) for "Watch
  together", and the `public` preset (Member gets chat, reactions, votes, requests and listening) for `/parties`; both
  editable at any time.
- Decided: quick parties are `unlisted`, guests allowed, chat on, no capacity, no password, `idle_close` 15 minutes;
  `/parties` rooms are `public`.
- Decided: one roster across every path, with source, roles, sync, voice and away; outside the room only
  `toRosterPreview` is used: at most 5 faces of accounts that allow it, everyone else counted by source, no faces for
  private rooms, Discord names only on Discord surfaces.
- Decided: personal controls are per target member key, room-scoped by default or everywhere for accounts, stored in
  `watch_party_personal_controls` (not 97's preferences, which hold fixed-shape settings), synced through a 98 event,
  applied on the client so the target never knows, party-only rather than a platform block, and never touching
  moderation or roles.
- Decided: one WebSocket per member per room for sync, chat, reactions, the roster, roles and requests, not 98's stream
  (one way, per user, a second of relay latency) and not two sockets (two tickets, no shared ordering).
- Decided: the room clock lives in Postgres with a CAS on the playback and roles versions, fanned out through Redis;
  Redis holds only short-lived state (tickets, presence, credentials, budgets, votes, the roles version cache). A pod
  dying loses no room state.
- Decided: pod wall clocks are the time source, with a skew metric and alert rather than a clock service.
- Decided: drift thresholds 250 ms and 2 s, a 5 % rate nudge between them and a hard seek above.
- Decided: buffering waits only in rooms of 12 or fewer, at most 10 s, and never for a guest.
- Decided: scrypt through `node:crypto` behind `PasswordHasherPort`, not argon2.
- Decided: per-recipient invites and invite links skip the password and never the capacity.
- Decided: capacity counts present sockets of every kind; the owner is never refused and `members.joinWhenFull` holders
  pass `capacity` but not the ceiling; lowering it kicks nobody; the ceiling is `WATCH_PARTY_MAX_MEMBERS`, default 200.
- Decided: the chat reuses 76's validator, gate, hub, resume and kit, with its own table.
- Decided: queue and role edits are REST and broadcast on the socket; playlists are copied into the queue, not linked.
- Decided: no live broadcasts and no private videos in rooms; unlisted videos only in non-public rooms.
- Decided: discovery search is 47's Postgres engine over a room `search_text`; rooms stay out of `GET /v1/search`.
- Decided: discovery live updates are SSE (one way, anonymous) on 98's hub.
- Decided: a room sets an accent only, through `BrandScope`; role colours only tint badges.
- Decided: `qrcode` for the QR code, rendered to SVG in the browser.
- Decided: 140 contains no Discord code; 78 issues Discord credentials and maps activity instances to rooms, 142 bridges chat;
  no voice is relayed to or from Discord.
- Decided: the sweep runs in the API on a `Poller` in every pod, not in the worker's housekeeping stage: the owner hand-over announces `owner` and `closed` frames from `@vp/api-contracts`, which the worker does not depend on, and the presence it reads is the API's. Each write is a compare-and-set, so every pod may run it.
- Decided: SDD gains ADR-31, "Watch parties: a server-authoritative room clock, room roles and party principals on one
  socket", recording the transport, the CAS clock, the fan-out, the capacity ceiling, the roles model and the credential
  boundary.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PRs.
- [ ] `docs/SDD.md`: §5 (the tables), §6.1 (every endpoint above), §6.2 (the codes), §9.8 (a note that the sweep runs in the API), §10.4 (the two
      kinds and group keys), a new §10.7 Watch parties (socket order, clock, drift, fan-out, capacity, roles, principals,
      the roster and its privacy projection, personal controls), ADR-27's WebSocket line naming 140 instead of 78, the
      new ADR-31, §11 (the party credential and its route boundary), §13.1 metrics, §13.5 alerts, §14.2 S8, §16 the env
      keys.
- [ ] `ARCHITECTURE.md` §3 lists `WatchPartyGatePort`, `WatchPartyPresencePort`, `PartyGuestSessionsPort` and
      `PasswordHasherPort`, and its permissions section the room-scoped ability; `CONTEXT.md` gains the vocabulary above;
      `README.md` lists watch parties; `.env.example` carries `WATCH_PARTY_MAX_MEMBERS`, `WATCH_PARTY_MAX_OPEN_PER_USER`
      and `WATCH_PARTY_GUEST_SALT` (secret-shaped, no default, a local value in `.env.example` that production refuses,
      as `LIVE_HOOK_SECRET` does).
- [ ] The design screens, component docs and wrapper rows of sections 11 and 12 are in `docs/design/`.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
