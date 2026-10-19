# Data sources

Where every surface gets its data: the endpoint that serves it today, or the ticket that adds it, how it arrives,
and what the surface shows until then. A smart wrapper ([architecture section 5](architecture.md#5-smart-wrappers-in-the-apps))
reads its source through one query factory, so a fallback swaps for the real source without touching the page.

## Transports

| Transport | Used for | Why |
|---|---|---|
| REST through `@vp/api-client` and TanStack Query | every read and write | cached, typed by `@vp/api-contracts`, loaders render it on the server |
| SSE, the user stream `GET /v1/me/events` ([98](../tickets/98-realtime-user-event-stream.md)) | anything pushed to one signed-in person: notifications, unread counts, a subscribed channel going live, a comment on the creator's video, processing progress, preferences changed on another device | one-way, replayable by `Last-Event-ID`, one connection per browser shared across tabs, the SSE stack the platform already runs |
| SSE, the video stream `GET /v1/videos/:id/events` | processing status of one video; live viewer count and status | the same, scoped to one video, anonymous allowed |
| WebSocket `/v1/live/:id/chat` ([76](../tickets/76-live-streaming-rtmp-whip-llhls-packaging-chat.md)) | live chat | the one surface where every viewer also sends often |

The rule (SDD ADR-27): SSE for server to client; a WebSocket only where the client sends often too.

## Web

| Surface or component | Data | Source | Until then |
|---|---|---|---|
| `AppShell` rail | subscribed channels | `GET /v1/me/subscriptions` | |
| rail live dot | a subscribed channel is live | channel `live` field and `live.started` / `live.ended` events ([76](../tickets/76-live-streaming-rtmp-whip-llhls-packaging-chat.md), [98](../tickets/98-realtime-user-event-stream.md)) | no dot |
| header bell, `NotificationCentre` | notifications, unread count | `GET /v1/me/notifications`, `unread-count`, `notification.*` events ([99](../tickets/99-notifications.md)) | bell hidden |
| `CommandPalette` | suggestions; settings rows; actions | `GET /v1/search/suggestions`; the settings index ([72](../tickets/72-frontend-settings-customization-system.md)); the client | |
| `ChipBar` | categories | `GET /v1/categories` | |
| `PickOfTheDay` | the pick, note, window | `GET /v1/picks/current` ([101](../tickets/101-pick-of-the-day-curation.md)) | top trending video, no note |
| home shelves and reason labels | shelves with reasons | `GET /v1/home` ([100](../tickets/100-home-shelves-related-videos.md)) | the feed per category, no reasons |
| `VideoCard` | summary, channel, sprite | `GET /v1/feed`, `/v1/home`, `/v1/search`, `/v1/feed/subscriptions` | |
| `VideoCard` progress | the viewer's progress | `viewer` on every summary ([100](../tickets/100-home-shelves-related-videos.md)) | no progress bar |
| Shorts shelf, `/shorts`, `ShortsPlayerFrame` | Shorts | `GET /v1/feed?format=short`, `GET /v1/shorts` ([102](../tickets/102-shorts.md)) | shelf and route hidden |
| Live now shelf, `/live`, `LiveChat` | live streams, chat | `GET /v1/live`, the chat WebSocket ([76](../tickets/76-live-streaming-rtmp-whip-llhls-packaging-chat.md)) | shelf hidden, `/live` empty state |
| `Stage` | playback, poster, sprite | `GET /v1/videos/:id` | |
| `EngagementBar` | reactions, subscription, save | `PUT /v1/videos/:id/reactions`, `/reactions/me`; `/v1/channels/:id/subscribers(/me)`; `/v1/me/playlists`, `/v1/playlists/:id/items` | |
| `EngagementBar` Clip | clips | `POST /v1/videos/:id/clips` ([105](../tickets/105-clips.md)) | action hidden |
| `LinerNotes` | description, views, chapters | `GET /v1/videos/:id` (chapters parsed from the description) | |
| `Queue` | the viewer's queue and playlist | client state ([73](../tickets/73-frontend-youtube-playlists-library-player-queue.md)), `GET /v1/playlists/:id` | |
| More like this | related videos | `GET /v1/videos/:id/related` ([100](../tickets/100-home-shelves-related-videos.md)) | the public feed |
| `CommentThread`, `CommentItem` | comments, replies, pin | `GET /v1/videos/:id/comments`, `/v1/comments/:id/replies`, `/pin` | |
| creator heart, Report | hearts, reports | `/v1/comments/:id/heart`, `/reports` ([103](../tickets/103-comment-hearts-reports-creator-inbox.md)) | heart and Report hidden |
| `ChannelHeader` | channel, counts, live | `GET /v1/channels/:idOrHandle`; `videoCount`, `totalViews` ([104](../tickets/104-channel-page-data.md)); `live` ([76](../tickets/76-live-streaming-rtmp-whip-llhls-packaging-chat.md)) | subscriber count only |
| `StartHereShelf` | pinned videos or most watched | `GET /v1/channels/:idOrHandle/featured` ([96](../tickets/96-channel-featured-videos-start-here.md)) | the channel's most-viewed uploads |
| channel Videos tab | public videos | the channel videos endpoint ([58](../tickets/58-modern-browse-layout-microinteractions-motion.md)) | |
| channel Playlists, About tabs | public playlists, links, stats | [104](../tickets/104-channel-page-data.md) | tabs hidden |
| channel Community tab | posts | none yet | tab hidden |
| You hub, history, Watch later, playlists | history, playlists | `GET /v1/me/history`, `/v1/me/playlists`, `/v1/creator/videos` | |
| Search results | results | `GET /v1/search` | |
| Settings area | preferences | the device cookie, `GET` and `PATCH /v1/me/preferences` ([97](../tickets/97-account-preferences-api.md)), `preferences.updated` events | device only |
| `OfflineState` | connectivity | the browser (`onlineManager`) | |
| `NowPlayingBar` | the playing video | client state ([73](../tickets/73-frontend-youtube-playlists-library-player-queue.md)) | |

## Studio

| Surface or component | Data | Source | Until then |
|---|---|---|---|
| `StudioWorkspace` | the creator, nav badges | `GET /v1/me/account`; unread comments ([103](../tickets/103-comment-hearts-reports-creator-inbox.md)) | no badges |
| library `DataTable`, `LibraryVideoRow` | the creator's videos | `GET /v1/creator/videos`, `PATCH`, `DELETE /v1/creator/videos/:id` | |
| upload progress | bytes, processing | the upload endpoints; `video.processing` on the user stream | |
| dashboard `StatCard`, charts | channel and video analytics | `GET /v1/creator/channel/analytics`, `/v1/creator/videos/:id/analytics`; retention ([65](../tickets/65-first-party-video-playback-telemetry-analytics-beacon.md)) | no retention curve |
| dashboard latest comments, `/comments` | the creator's inbox | `GET /v1/creator/comments`, `comment.created` events ([103](../tickets/103-comment-hearts-reports-creator-inbox.md)) | section hidden |
| `/customization` | channel profile, links, Start here | `PATCH /v1/me/channel` ([104](../tickets/104-channel-page-data.md) for links), `PUT /v1/me/channel/featured` ([96](../tickets/96-channel-featured-videos-start-here.md)) | |
| admin categories | categories | `/v1/admin/categories` | |
| admin moderation | reports, takedowns | `/v1/admin/reports` ([103](../tickets/103-comment-hearts-reports-creator-inbox.md)), `/v1/admin/videos/:id/takedown` | reports queue hidden |
| admin curation | picks | `/v1/admin/picks` ([101](../tickets/101-pick-of-the-day-curation.md)) | page absent |
| admin queues | the dead-letter queue | `/v1/admin/dlq` | |

A surface with no row here, or a row with "none yet", does not render: a tab, shelf or action appears only when
its source exists.
