# 141: Watch party voice chat - a self-hosted SFU, push-to-talk or open mic, speaking rings, per-user volume and ducking

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Issue | TBD |
| Size | L |
| Blocked by | 83 - Granular container topology · 140 - Watch parties |
| Blocks | 143 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) · [SDD §13.1 Metrics](../SDD.md#131-metrics-catalogue) · [SDD §14.2 Load scenarios](../SDD.md#142-scenarios) · [SDD P9 Local-first](../SDD.md#13-design-principles-used-to-break-ties-throughout) |

**Status:** blocked

> **Why.** A party is better when people can talk. [140](140-watch-parties.md) gives a room chat, roles and a roster,
> and already reserves `voice.join`, `voice.speak`, `voice.moderate`, the Speaker and Voice muted roles and the roster's
> voice fields. This ticket adds the voice itself and plugs in their enforcement, without touching a room's roles.

> **Local-first holds.** Voice runs on a media server in our own compose and k3d, with its own TURN, no STUN or TURN
> from anyone else, and it is off by default: `.env.example` leaves `WATCH_PARTY_VOICE_ENABLED=false`, the default
> `make up` starts no media server, and `make smoke-offline` is unchanged. Turning it on adds one container.

## The media server: research and decision

Group voice for up to the room ceiling (`WATCH_PARTY_MAX_MEMBERS`, 200) means many listeners and a handful of speakers.

| Option | Group voice at 200 | Local-first | What we would own | Verdict |
|---|---|---|---|---|
| **MediaMTX** (76 runs it for WHIP ingest) | Each speaker publishes a path and each listener opens one WHEP session per speaker: 10 speakers and 200 listeners is 2 000 peer connections, with no rooms, no per-participant permissions, no active-speaker detection and no server-side mute | yes, already in compose | rooms, permissions, mute, speaker detection, reconnect, every piece of a conferencing server | Rejected: a broadcast relay, not a conferencing SFU |
| **Mesh WebRTC** | Every member sends to every other: n(n-1) streams, fine at 4, impossible at 200 | yes, plus our own TURN | signalling, and a second path for rooms past a handful | Rejected: two code paths, and it fails exactly where public rooms live |
| **mediasoup** | Scales well | yes | a Node library with a C++ worker built at install, so a native build in our images, plus all signalling, rooms, permissions, reconnect, simulcast and TURN | Rejected: the most code to own, and a native addon against the dual-runtime image story |
| **LiveKit server** (Apache-2.0, one Go binary, `livekit/livekit-server` image) | An SFU built for rooms: one connection per participant, audio forwarded not mixed, Opus with DTX, active-speaker detection, per-participant grants (`canPublish`, `canSubscribe`) and a server API to mute, update grants and remove | yes: runs in compose and k3d, uses our Redis for multi-node routing, has an embedded TURN server, and can be pinned to make no outbound call (below) | a token minter, a webhook receiver and a client wrapper | **Accepted** |

**Making LiveKit local-first**: `rtc.use_external_ip: false` with `rtc.node_ip` set from config (its external IP
discovery otherwise asks public STUN servers), no `stun_servers`, the embedded TURN on (`turn.enabled`, UDP 3478 and
TLS 5349 in the cloud overlay) so no Google or third-party STUN or TURN is ever used, a single UDP port (`rtc.udp_port:
7882`) plus ICE over TCP (`rtc.tcp_port: 7881`) so compose and k3d map two ports instead of a range, Redis from our
compose, and no egress, ingress or agents services deployed at all. coturn is not needed: LiveKit's TURN covers the
same NAT cases for its own sessions, and one fewer container is one fewer thing to secure. An offline voice smoke
(below) proves no outbound connection.

## Where the code lives

| What | Where |
|---|---|
| The port | new `packages/server/core/ports/voice-gateway.ts` (`VoiceGatewayPort`: mint a join token with grants, update a participant's grants, mute a track, remove a participant, list participants, verify a webhook) |
| Adapters | new `packages/server/adapters/livekit/livekit-voice-gateway.ts` over `livekit-server-sdk` at its current major (2.x today; rule 4's SDK list gains it), and an in-memory twin in `in-memory/`; contract suite in `adapters/__tests__/contract/` |
| Config | `packages/server/env-schema/src/app-env.ts` (keys below), new `voice-config.ts`; `.env.example` |
| API | routes `apps/server/api/src/routes/watch-party-voice.ts`; services under `apps/server/api/src/services/watch-party/voice/`; registered in `composition/watch-party.module.ts` only when voice is on |
| Contracts | new `packages/universal/api-contracts/src/watch-party-voice.ts` |
| Client | `livekit-client` at its current major (2.x today) behind a client port `apps/client/web/src/features/watch-party/voice/voice-port.ts` (the player-port pattern of 57), loaded with `lazyComponent` only when someone joins voice; UI in `features/watch-party/voice/` and the kit `components/party/voice-tile/` |
| Compose | a `livekit` service in a `voice` profile in `infra/compose/docker-compose.yml`, its config in `infra/compose/livekit/livekit.yaml`, the image pinned by digest like MinIO's |
| k3d and cloud | new `infra/k8s/base/livekit.yaml` (Deployment, Service for 7880 TCP, 7881 TCP and 7882 UDP, the config map), `make k3d-up` maps the two media ports; the cloud overlay sets `node_ip` and TURN TLS |
| Load | new `tests/load/s9-watch-party-voice.md` (the `lk load-test` recipe and thresholds) |

## What to build

### 1. Turning it on

- Env keys, all declared in `env-schema` and mirrored in `.env.example`: `WATCH_PARTY_VOICE_ENABLED` (default `false`),
  `LIVEKIT_URL` (the WebSocket URL browsers use, local `ws://localhost:7880`), `LIVEKIT_API_URL` (server to server,
  `http://livekit:7880`), `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` (secret-shaped: no default in the schema, local
  values in `.env.example` that production refuses, as `LIVE_HOOK_SECRET` does), `WATCH_PARTY_VOICE_MAX_SPEAKERS`
  (default 12).
- Off, nothing changes: no route registered, the room's `features.voice` is `false`, and 140's editor and menus hide
  voice.
- On, `make up voice` (or `make up all` with the profile) starts LiveKit; the API checks it on `/readyz` only when on.

### 2. Joining voice, speaking and listening

- One LiveKit room per watch party (`party:<roomId>`), created on first join and closed by LiveKit when empty.
- `POST /v1/watch-parties/:id/voice/token` (`partyGuest`, so accounts, Discord members and guests): the server computes
  the caller's effective permissions (140's `effectivePermissions`) and mints a 10-minute token with `canSubscribe`
  from `voice.join` and `canPublish` (audio only, no data, no video, no screen share) from `voice.speak`, the identity
  set to the member key and the display name from the roster. No `voice.join` is `WATCH_PARTY_PERMISSION_MISSING`.
  Guests get listen-only tokens by 140's ceiling.
- **Speakers are capped** at `WATCH_PARTY_VOICE_MAX_SPEAKERS` live publishers per room; past it, a member with
  `voice.speak` joins as a listener with a "Speakers full" note and a "Request to speak" (140's request, kind `speak`,
  added to its registry as a request kind). The cap keeps a listener's download bounded.
- **Live enforcement**: every role change in 140 (`roles`, `member.roles`) reaches the voice service through the room's
  hub, which recomputes each voice participant's grants and calls `updateParticipant` to add or drop `canPublish` and
  `canSubscribe` within a second, so Voice muted, a revoked Speaker or Spectator take effect in the SFU itself, not only
  in the UI. Removing 140's `PENDING_ENFORCEMENT` entries is part of this ticket: the per-permission spec then covers
  `voice.*` too.
- **Moderation** (`voice.moderate`, 140's hierarchy): "Mute in voice" assigns Voice muted (10 min, 1 h or the rest of
  the party) and the SFU drops the grant; "Move to listener" revokes Speaker; "Remove from voice" disconnects the voice
  connection only, leaving the member in the room.
- **Self-mute** is the client toggling its own microphone track, not a role and not 140's Voice muted; the roster shows
  `self_muted`, and the user lifts it any time.
- **Webhooks**: LiveKit's `participant_joined` and `participant_left` (verified with the API key through the port) set
  the roster's voice state (`listening`, `live`, `self_muted`, `server_muted`) via 140's `roster.patch`. Speaking itself
  never goes through our server: each client reads LiveKit's active speakers.

### 3. The voice UI

- A "Join voice" button in the party header and the People tab; joining asks for the microphone only when the member can
  speak, and a listener never sees a permission prompt.
- **Push-to-talk or open mic**: a room setting `voice_mode` (`open` default for the `friends` preset, `push_to_talk` for
  `public`, editable by `room.edit`), and every member can choose push-to-talk for themselves in any room. The key is a
  held `V` on a keyboard (not while typing in a field) and a hold-to-talk button on touch; the button is 44 px and
  announces its state.
- **Speaking indicator**: a ring around the avatar in 140's roster and in the voice tiles while LiveKit reports them
  speaking (eased on the motion tokens, a static marker under reduced motion), and a "Talking: Ana, Tom" line for screen
  readers updated at most once a second.
- **Per-user volume and mute for me**: 140's personal controls (section 9) drive `setVolume` (0 to 200 %) and unsubscribe
  from a muted member's track, so a muted member costs the viewer no bandwidth.
- **Noise suppression**: the capture uses the browser's `noiseSuppression`, `echoCancellation` and `autoGainControl`
  constraints, on by default with a per-device toggle in the voice menu; no hosted noise model (LiveKit's enhanced
  noise cancellation is a cloud feature and is not used).
- **Ducking**: while anyone the viewer has not muted is speaking, the player's volume drops to a per-viewer level
  (default 40 %, off, 20 to 80 %) through the player port, with a 150 ms attack and a 600 ms release so it does not pump;
  saved in 140's `party` preferences section.
- **Device menu**: microphone and output selection (`setSinkId` where the browser has it), an input level meter and a
  test tone.
- **Mobile and background**: when the page is hidden on a phone, the client stops its microphone (browsers suspend
  capture in the background anyway) and shows "Mic paused while in the background" on return; incoming voice keeps
  playing while the browser keeps the page alive, and if the connection drops it rejoins on return. On iOS the voice
  join is triggered by a tap so the audio session starts. Landscape fullscreen keeps a small push-to-talk button.
- **Privacy**: voice is never recorded. No egress service is deployed, so the server cannot record; joining voice shows
  "Voice is not recorded" once per room. Clients could record locally; that is outside our control and the copy does not
  pretend otherwise.

### 4. Abuse

- 140's member report gains `context: voice`; there is no recording, so a voice report carries the reporter's words and
  the time. Three open voice reports from distinct accounts on the same member in a room assign Voice muted until a
  holder of `voice.moderate` lifts it, unless the target holds `voice.moderate` themselves (so a brigade cannot silence
  moderators).
- Token minting is budgeted 10 per minute per member key; joins and leaves flapping more than 20 times in a minute drop
  the member from voice for a minute.
- The speaker cap and push-to-talk default for public rooms bound how loud a raid can be.

### 5. Budgets

Estimates to be confirmed by S9, written down so the measurement has something to beat:

- **Bandwidth**: Opus mono speech at about 32 kbit/s with DTX (near zero when silent). A listener downloads one stream per
  active speaker, so 4 people talking at once is about 128 kbit/s down; a speaker uploads about 32 kbit/s. Server egress
  for a 200-person room with 4 active speakers is about 26 Mbit/s.
- **CPU**: an SFU forwards audio without decoding it, so CPU grows with packets forwarded, not with mixing; S9 measures the
  ceiling room on one LiveKit pod and sets the per-pod room budget from it.
- **Client**: the voice chunk is loaded only on join; with voice off, no page pays for it.

### 6. Observability

- LiveKit's own Prometheus endpoint (`prometheus_port`) scraped by the compose Prometheus and a `ServiceMonitor` in k3d:
  participants, packet loss, jitter, round-trip time per node.
- API metrics: `watch_party_voice_participants` (gauge, `role`: speaker, listener), `watch_party_voice_tokens_total`
  (`outcome`), `watch_party_voice_grant_updates_seconds` (histogram, role change to SFU grant), `watch_party_voice_reports_total`.
- Panels added to 140's `watch-parties.json`; alerts `WatchPartyVoicePacketLossHigh` (loss over 5 % for 10 min) and
  `WatchPartyVoiceGrantSlow` (grant update p95 over 2 s for 10 min), each with a runbook.

### 7. Load

k6 cannot speak WebRTC, so S9 uses LiveKit's own load tool (`lk load-test`, run from a container in the voice profile):
200 subscribers and 12 audio publishers in one room, then 50 rooms of 8 with 3 publishers, on one LiveKit pod. Pass:
packet loss under 1 %, no subscriber dropped, LiveKit CPU under 70 % of its limit, and the grant update p95 under 1 s
while 140's S8 runs beside it. Results under `docs/load-tests/results/`.

## Endpoints

| Method and path | Purpose | Request | Response | Notes |
|---|---|---|---|---|
| `POST /v1/watch-parties/:id/voice/token` | Voice token | - | `201 { url, token, expiresAt, canSpeak }` / `403 WATCH_PARTY_PERMISSION_MISSING` / `404` / `409 WATCH_PARTY_VOICE_SPEAKERS_FULL` (as speaker; listener still allowed) / `503 WATCH_PARTY_VOICE_UNAVAILABLE` | `partyGuest`; only registered when voice is on. |
| `POST /v1/watch-parties/:id/voice/members/:memberKey/remove` | Remove from voice | - | `204` / `403` | `voice.moderate`, 140's hierarchy. |
| `POST /v1/internal/voice/webhook` | LiveKit webhooks | LiveKit's signed body | `204` / `401` | LiveKit only, left out of the OpenAPI document. |

"Mute in voice" and "Move to listener" are 140's role endpoints (assign Voice muted, revoke Speaker); no second path.

## Acceptance criteria

- [ ] With `WATCH_PARTY_VOICE_ENABLED=false` (the default) no voice route exists, `features.voice` is `false`, the voice
      chunk is never loaded, and `make smoke-offline` passes unchanged.
- [ ] With it on, `make up voice` starts LiveKit and two browsers in one room hear each other; the voice smoke runs with
      outbound network blocked and LiveKit makes no connection outside the compose network.
- [ ] Each `voice.*` permission is enforced in the SFU: without `voice.join` no token; without `voice.speak` a listener
      token, and a forged publish is rejected by LiveKit; 140's per-permission spec passes with `PENDING_ENFORCEMENT`
      empty.
- [ ] Assigning Voice muted to a speaker removes their audio for everyone within 1 s while their chat still works;
      assigning Chat muted leaves their voice alone; both together each lift on their own expiry.
- [ ] Self-mute shows `self_muted` in the roster and never assigns a role.
- [ ] A guest joins voice as a listener and can never publish, whatever the roles say.
- [ ] Speaker cap: the 13th would-be speaker joins as a listener with "Speakers full" and can request to speak.
- [ ] Push-to-talk: in a `push_to_talk` room nothing is sent until `V` or the button is held; a member may choose it in an
      `open` room.
- [ ] The speaking ring follows LiveKit's active speakers and is static under reduced motion; the screen-reader line
      updates at most once a second.
- [ ] Per-user volume (0 to 200 %) and "mute for me" apply only for the viewer, and a muted member's track is unsubscribed.
- [ ] Ducking lowers the video while someone audible speaks and restores it after release, with the viewer's level.
- [ ] Hiding the page on a phone stops the microphone and resumes the listener connection on return.
- [ ] Three voice reports from distinct accounts mute the target in voice, but not a holder of `voice.moderate`.
- [ ] S9 meets its thresholds with results committed; the voice panels and alerts exist with runbooks.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts` (no
      diff) green, with output in the PR.

## Delivery

One stack, `feat/141-watch-party-voice-chat`, three slices: (a) the port and both adapters, the env keys, compose and
k3d, the token and webhook endpoints, grant enforcement on role changes, the voice smoke; (b) the client port, voice UI,
push-to-talk, speaking rings, volume, ducking, devices, mobile behaviour; (c) reports and auto-mute, metrics, alerts,
runbooks, S9, docs.

## Out of scope

- Camera and screen share.
- Recording, transcription and live captions of voice (live captions need streaming speech-to-text, which
  [111](111-captions-and-transcripts.md) left out).
- Relaying voice to or from Discord: dropped ([142](142-discord-party-bridge.md)'s Decided); Discord members talk in
  Discord through 78's Activity.
- Spatial audio.

## Testing plan

- Ports: the `VoiceGatewayPort` contract suite over the in-memory twin and, in the integration job with the voice
  profile, LiveKit itself.
- API: token grants as a table over roles and principal kinds; grant updates on `roles` and `member.roles`; webhook
  verification.
- Web: the voice port against a fake engine (speaking, volume, ducking timing with fake timers, push-to-talk keys).
- E2E: two Chromium contexts with fake media devices (`--use-fake-device-for-media-stream`) in the voice profile.
- Load: S9.

## Open questions

None.

- Decided: LiveKit server over MediaMTX, mesh and mediasoup, for the reasons in the table; its embedded TURN instead of
  coturn; no public STUN or TURN, ever.
- Decided: one LiveKit room per party, audio only, a speaker cap of 12 by default.
- Decided: enforcement lives in the SFU grants, recomputed on every 140 role change, so a mute is real, not cosmetic.
- Decided: open mic for `friends` rooms and push-to-talk for `public` rooms, each overridable per member.
- Decided: noise suppression through the browser's constraints, ducking through the player port, no hosted audio models.
- Decided: never recorded; no egress service deployed.
- Decided: voice is its own ticket, because the media server, its ports in compose and k3d, the client engine and the
  load method are a separate stack from 140's three slices; 140 owns the permissions, roles and roster fields, so this
  ticket only plugs in their enforcement.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PRs.
- [ ] `docs/SDD.md` (§6.1, a voice subsection under 140's §10.7, §12 the voice profile and k3d ports, §13.1, §14.2 S9,
      §16 env, an ADR for the media server choice), `ARCHITECTURE.md` (`VoiceGatewayPort`, rule 4's SDK list),
      `docs/LOCAL_FIRST.md` (LiveKit in the local table, off by default), `README.md` and `.env.example` updated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
