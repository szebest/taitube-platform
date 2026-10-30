# 134: Settings follow-ups - the player and queue read the playback defaults, the account switch reset, and avatar and banner upload

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M |
| Blocked by | 72 - Settings |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** ready

> **Why.** [72](72-frontend-settings-customization-system.md) merged with the settings saving them, but not the readers of two of them, the switch, or file upload, so these moved here.

## What to build

- **Playback readers.** Hover preview is read by the feed card. The player ([57](57-production-video-player-hls-streaming-controls.md)) reads none of quality, speed, captions defaults or the stats overlay, and the queue does not read autoplay next. Read each through `usePlaybackPreference` and apply it to the next video.
- **Account and channel switch.** Switching identity ([129](129-multiple-accounts-and-channels.md)) clears the `['preferences']` query and the device-merge state, so the new identity never sees the old one's settings. This waits on 129 for the switch itself; build the reset as a function 129 calls.
- **Avatar and banner upload.** The studio's `/customization` takes https addresses because `PATCH /v1/me/channel` takes URLs and [38](38-user-channel-identity-universal-auth.md) deferred files. Add the upload (presigned, through `FileField` on `@vp/ui`) with preview and safe-zone guides, and handle availability from an endpoint instead of the 409 on save if the API grows one.

## Acceptance criteria

- [ ] Playback defaults (quality, speed, captions, stats overlay) are honoured by the player on the next video, and autoplay next by the queue.
- [ ] Switching account or channel shows only the new identity's settings and preferences, with no stale cache.
- [ ] The studio's channel form uploads an avatar and a banner from a file, with preview and safe-zone guides, and `PATCH /v1/me/channel` saves the resulting keys.
- [ ] `pnpm typecheck`, `pnpm lint` and the touched packages' tests pass, with output in the PR.

## Out of scope

- The locale selector: 86.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
