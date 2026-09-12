# 78: Discord integration ecosystem — Taitube Discord bot, Watch Together voice activity, creator alerts & community role sync

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 38, 41, 57, 76, 77 |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

## What to build

Discord is the primary community hub for online video creators and audiences. Deep Discord integration elevates Taitube from an isolated video repository into a social streaming ecosystem: viewers can watch videos together synchronously inside voice channels, creators can automatically notify their communities when videos publish or streams go live, and Discord servers can automatically reward Taitube channel subscribers with special server roles.

This ticket delivers the complete **Taitube Discord Integration Ecosystem**:

1. **Discord OAuth2 Account Linking & Community Hub (`/v1/auth/discord` & `/studio/integrations/discord`)**:
   - Secure Discord OAuth2 flow with `identify`, `guilds`, `bot`, and `role_connections.write` scopes:
     - `GET /v1/auth/discord/authorize`: Generates state nonce and redirects to Discord authorization consent.
     - `GET /v1/auth/discord/callback`: Exchanges authorization code, securely persists tokens in `user_connections` table (`user_id`, `provider = 'discord'`, `provider_user_id`, `access_token`, `refresh_token`, `scopes`, `guild_id`, `created_at`).
     - `DELETE /v1/me/connections/discord`: Unlinks Discord identity.
   - Creator Studio Discord Hub:
     - Allows creators to link their Discord Guild (Server).
     - Select notification announcement channel (e.g. `#announcements` or `#uploads`).
     - **Subscriber Role Syncing**: Automated role assignment in the creator's Discord server for verified Taitube channel subscribers and members via Discord Linked Roles (Role Connections metadata endpoint `PUT /v1/discord/role-metadata`).

2. **Official Taitube Discord Bot & Slash Commands (`packages/discord-bot`)**:
   - Lightweight Discord Interactions HTTP webhook handler with Ed25519 cryptographic signature verification (`X-Signature-Ed25519`, `X-Signature-Timestamp`):
     - **`/watch <query_or_url>`**: Returns rich Discord embed card containing video thumbnail poster, duration badge, view count, channel handle & avatar, description snippet, and interactive Action Row buttons: `Watch on Taitube`, `Add to Queue`, `Share`.
     - **`/live [channel]`**: Queries real-time streaming status; displays live badge, stream preview, viewer count, category pill, and direct stream join link.
     - **`/channel <handle>`**: Displays creator card with subscriber count, total video count, banner/avatar, and latest 3 video uploads.
     - **`/subscribe <handle>`**: Allows authenticated Discord users to subscribe directly from Discord.
   - **Creator Notification Alerts & Automated Webhook Dispatch**:
     - Fastify worker listens to `video.ready` and `stream.live` domain events.
     - Automatically crafts and dispatches rich embed announcements to configured guild channels with optional role ping (e.g. `@everyone`, `@NotificationSquad`).

3. **Discord "Watch Together" Activity (Discord Embedded App SDK)**:
   - YouTube's "Watch Together" equivalent inside Discord Voice Channels:
     - Implemented in `apps/web/src/routes/discord-activity.tsx` using `@discord/embedded-app-sdk`.
     - Authenticates participants within Discord voice chat context and embeds `<TaitubePlayer />`.
   - **Multi-User Synchronous Playback Room**:
     - Real-time room coordination backed by Redis Pub/Sub room channels:
       - Room state payload: `{ roomId, videoId, status: 'playing' | 'paused', currentTime, hostUserId, lastUpdate }`.
       - Automatic lockstep drift compensation: if a client's playback drifts by > 500ms from the room clock, performs smooth micro-scrub to realign.
       - Host & Participant Controls: Host controls play/pause/seek; participants can request seeks or vote to skip.
     - **Collaborative Voice Channel Queue**:
       - Participants can search Taitube videos, add upcoming videos to the shared room playlist, and reorder queue items.

4. **Discord Rich Presence (RPC Client)**:
   - Client-side integration displaying real-time activity status in user profile:
     - "Watching [Video Title] on Taitube" with elapsed/remaining duration, thumbnail asset key, and "Watch on Taitube" button.
     - "Streaming [Stream Title] on Taitube" with live badge and viewer count.

## Acceptance criteria

- [ ] Database migration adding `user_connections` table (`user_id`, `provider`, `provider_user_id`, `guild_id`, `credentials`, `timestamps`).
- [ ] Endpoints `GET /v1/auth/discord/authorize` and `GET /v1/auth/discord/callback` implemented with state nonce validation and secure token storage.
- [ ] Fastify Discord interaction endpoint `POST /v1/discord/interactions` verifying Ed25519 signatures and resolving `/watch`, `/live`, and `/channel` slash commands.
- [ ] Creator Studio integration UI (`/studio/integrations/discord`) allowing creators to select Discord announcement channel and role ping.
- [ ] Automatic notification dispatch: publishing a video (`video.ready`) or starting an RTMP/WHIP live stream (`stream.live`) sends a rich Discord embed to configured channels.
- [ ] Discord Linked Roles metadata endpoint `PUT /v1/discord/role-metadata` syncing subscriber status to Discord roles.
- [ ] Discord "Watch Together" activity route `/discord-activity` functional with `@discord/embedded-app-sdk`, synchronizing play/pause and queue state across multiple voice channel participants via Redis Pub/Sub.
- [ ] Integration tests verifying Ed25519 signature verification, slash command response payloads, and room synchronization clock drift handling.

## Out of scope

- Direct video file uploading through Discord attachment messages.
- Full Discord chat bridging into Taitube live stream chat.

## Notes for the implementer

- In local development (`LOCAL_FIRST=true`), mock Discord interaction requests using test Ed25519 keypairs without requiring live Discord developer portal credentials.
- When bundling the Discord Activity (`/discord-activity`), ensure CSP `frame-ancestors` permits `https://*.discord.com` and `https://*.discordsays.com`.
- Keep Discord bot interactions fast (< 3000ms SLA required by Discord): return an initial deferred interaction acknowledgement (`type: 5`) if video search requires database lookup.

## Testing plan

- Auth test: Initiate Discord OAuth2 authorization flow; verify code exchange and credential persistence in `user_connections`.
- Signature test: Send mock POST request to `/v1/discord/interactions` with valid and invalid Ed25519 signatures; verify invalid signatures return 401 Unauthorized.
- Slash command test: Execute `/watch query="distributed pipeline"` interaction; verify returned response contains rich embed with title, duration, and action buttons.
- Sync test: Connect two simulated activity clients to a room; emit seek event from client A; verify client B receives synchronization update and aligns playback time within 500ms.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] Discord interaction handler verified with Ed25519 test vectors.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `CONTEXT.md`, `docs/SDD.md` and ADRs if boundaries or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
