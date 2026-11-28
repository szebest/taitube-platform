# 176: Live chat replay on the watch page of a recording

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 76 - Live streaming (RTMP/WHIP ingestion, LL-HLS packaging, chat) |
| Blocks | — |
| Spec | [76 Live streaming](76-live-streaming-rtmp-whip-llhls-packaging-chat.md) · [119](119-playlists-customisation-and-collaboration.md) and [120](120-community-posts-and-threads.md) touch the same video contract and watch page |

**Status:** ready

## What to build

A viewer who opens the recording of a finished broadcast at `/watch/$videoId` sees its chat replay in the chat slot, synced to the playhead, the way `/live/$streamId` already shows it.

Today the replay only works on `/live/$streamId`. `useChatReplay(liveStreamId)` and `chatReplayQueryOptions` in `apps/client/web/src/features/live/` fetch `GET /v1/live/:id/chat/replay` by live stream id (`REPLAY_WINDOW_MS`, 30 s windows), and the watch page has no way to learn that id: `VideoSchema` carries no live stream reference. The link exists server side, as `live_streams.video_id` (unique, `packages/server/db/src/live-schema.ts`) and `findByVideoId` on the live stream repository.

Decided: add `liveStreamId: uuid | null` to the video resource, filled from `live_streams.video_id`, and mount `LiveChatReplay` on the watch page when it is set. A second request from the watch page (a lookup by video id) costs a round trip on every watch for a feature few videos have; the field rides the video read the page already makes.

## Acceptance criteria

- [ ] `VideoSchema` in `packages/universal/api-contracts` has `liveStreamId` (nullable, described), and `GET /v1/videos/:id` returns it for a recording of a stream and `null` for every other video. `pnpm gen:contracts` is committed.
- [ ] The id is read with the video, not by a second query per request in the route: one owner for the lookup, covered by the Postgres and in-memory repository contract tests.
- [ ] The visibility rules of the stream do not widen: a recording the viewer may watch but whose stream archive is not visible to them (`archiveVisibility`) gets `liveStreamId: null` or the replay endpoint's own refusal, one decided and tested.
- [ ] `/watch/$videoId` of a recording shows `LiveChatReplay` in the chat slot, lines appear by `offsetMs` against the playhead, and a video with no stream shows no chat slot.
- [ ] A browser spec or a recorded demo shows a recording playing with its replay on `/watch/$videoId`.
- [ ] `docs/SDD.md` names the field where it describes the video resource and the replay.

## Setup & environment

None. No env keys, no seed change beyond a recorded stream if the demo seed has none (check `docs/DEMO.md`).

## Out of scope

- Changing the replay endpoint, its window size or its page limit.
- Replay for shorts, clips or the embed route.
- Rewriting `/live/$streamId`.

## Notes for the implementer

- Raised in the PR bodies of [#292](https://github.com/szebest/taitube-platform/pull/292) and [#294](https://github.com/szebest/taitube-platform/pull/294): "`/watch/$videoId` of a recording does not know its live stream yet (the video resource has no `liveStreamId`), so replay there is left for a follow-up". 76's own AC mentions `/watch?v={videoId}`, so that part of 76 is met only on `/live/$streamId`.
- 119 and 120 also edit the video contract and the watch page. Check the open PRs for both before slicing and rebase on whichever lands first.
- `useChatReplay` takes a stream id already: the change is the contract field and the mount, not the hook.

## Testing plan

Contract test for the new field (null and set), repository contract test for the lookup on both repositories, a component spec for the watch page with and without `liveStreamId`, one browser spec.

## Open questions

- None.

## Definition of Done

- [ ] Merged; SDD updated; `gen-index.py` re-run.
