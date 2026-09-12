# 77: Platform integrations ecosystem — oEmbed provider, embeddable iframe player, Discord/Twitter rich unfurls & webhooks

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#77](https://github.com/szebest/taitube-platform/issues/77) |
| Size | M |
| Blocked by | 38 — User identity · 57 — Production video player · 63 — TanStack Router SSR |
| Blocks | 78 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

## What to build

Modern streaming platforms thrive on seamless embedding and integration across the wider web: pasting a video link in Discord, Reddit, Twitter/X, Notion, or Slack should produce a playable inline video player or rich media embed, while third-party apps need standard APIs to interact with creator channels.

This ticket delivers the **Platform Integrations & External Sharing Ecosystem**:

1. **Standard oEmbed Provider (`GET /v1/oembed`)**:
   - Implements the official [oEmbed specification](https://oembed.com/):
     - `GET /v1/oembed?url=https://taitube.tv/watch?v=...&format=json&maxwidth=...&maxheight=...`
     - Returns standard JSON payload:
       ```json
       {
         "type": "video",
         "version": "1.0",
         "title": "Building a Distributed Video Pipeline",
         "author_name": "Mateusz Szebestik",
         "author_url": "https://taitube.tv/channels/@mateusz",
         "provider_name": "Taitube",
         "provider_url": "https://taitube.tv",
         "thumbnail_url": "https://cdn.taitube.tv/posters/uuid.jpg",
         "thumbnail_width": 1280,
         "thumbnail_height": 720,
         "html": "<iframe src=\"https://taitube.tv/embed/uuid\" width=\"640\" height=\"360\" frameborder=\"0\" allowfullscreen></iframe>",
         "width": 640,
         "height": 360
       }
       ```
   - Automated oEmbed discovery tags injected into `<head>`: `<link rel="alternate" type="application/json+oembed" href="...">`.

2. **Standalone Embed Player (`/embed/:id`)**:
   - Lightweight, standalone HTML page hosting `<TaitubePlayer />` with minimal chrome designed for `<iframe>` embedding.
   - Respects embed query parameters:
     - `?autoplay=1`: Starts playback muted upon mount.
     - `?t=120`: Starts playback at 2m00s.
     - `?controls=0`: Hides UI controls.
     - `?loop=1`: Loops playback.
   - Privacy-enhanced mode: Omits cross-site cookies, transmitting telemetry solely with ephemeral playback session IDs.
   - Strict `Content-Security-Policy` and `X-Frame-Options` allowing embedding across external websites while protecting against clickjacking.

3. **Discord, Twitter/X, Telegram & Slack Rich Unfurl Engine**:
   - Generates Twitter Player Card tags:
     - `twitter:card=player`
     - `twitter:player=https://taitube.tv/embed/:id`
     - `twitter:player:width=1280`
     - `twitter:player:height=720`
   - OpenGraph Video Tags allowing instant inline playback directly within Discord chat channels without leaving Discord.

4. **Outgoing Creator Webhooks (`/v1/me/webhooks`)**:
   - Allows creators to register outbound webhooks (Discord / Slack / Zapier / custom URLs):
     - Events: `video.ready` (triggers when transcode finishes), `live.started` (notifies Discord channel when creator goes live), `video.milestone` (triggers at 1k, 10k, 100k views).
   - HMAC-SHA256 signature header (`X-Taitube-Signature-256`) sent with each dispatch for cryptographic verification.

## Acceptance criteria

- [ ] Endpoint `GET /v1/oembed` implemented returning specification-compliant JSON representation for public videos.
- [ ] HTML `<head>` on `/watch/$videoId` includes `<link rel="alternate" type="application/json+oembed">` discovery tags.
- [ ] Standalone embed route `/embed/:id` implemented in `apps/web/src/routes/embed.$id.tsx` rendering lightweight `<TaitubePlayer />`.
- [ ] Embed player respects `autoplay`, `t`, `controls`, and `loop` URL query parameters.
- [ ] OpenGraph and Twitter Player Card tags verified: Discord and Twitter link crawlers display playable video card previews.
- [ ] Outgoing creator webhooks API (`POST /v1/me/webhooks`, `GET /v1/me/webhooks`, `DELETE /v1/me/webhooks/:id`) supporting `video.ready` and `live.started` events with HMAC signatures.
- [ ] Integration tests verifying oEmbed response validation, iframe embed rendering, and webhook dispatch signing.

## Out of scope

- Third-party OAuth developer apps / App Marketplace.

## Notes for the implementer

- Ensure iframe embeds include `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"` attributes.
- Keep embed route bundle size minimal: do not load sidebar, comments, or header chunks on `/embed/:id`.

## Testing plan

- oEmbed test: Call `GET /v1/oembed?url=...` with curl; validate JSON response schema against official oEmbed test suite.
- Iframe test: Render an HTML page containing `<iframe src="http://localhost:5173/embed/:id">`; verify video plays inside frame.
- Webhook test: Trigger a video publish event; verify webhook listener receives payload with valid HMAC-SHA256 signature.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] Verified video embeds render and play cleanly inside third-party iframe test page.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
