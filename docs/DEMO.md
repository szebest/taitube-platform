# The demo world

`make demo` ends with a platform that looks lived in. This page describes what is in it, how to sign in as each
persona, a ten-minute tour of the features, and how to extend the seed. Setup and options are in
[GETTING_STARTED.md](GETTING_STARTED.md).

## How it is built

The seed is a client of the real public API, so every row goes through the same services the apps use:

- Identities are the one thing no public route creates (users, roles), so `@vp/db` exposes an idempotent
  `upsertIdentities`, called with the database URL from `.env`.
- Everything else is HTTP with dev tokens: channels, images, uploads, comments, reactions, subscriptions, playlists,
  history, reports. Videos are real uploads that go through probe, transcode, thumbnail, screening and packaging, so
  HLS, posters and sprites exist. Clips are generated with ffmpeg test sources and a sine tone (no network, no fonts),
  cached in `.demo/media`.
- One `--seed` gives one world: same names, titles, clips, comments and likes. A re-run adds nothing; it looks each
  thing up first.
- A scenario that needs a route the build does not have is skipped with a line such as
  `skipped <name>: needs <route> (not in this build)` and never fails the run.

Code: [packages/server/demo](../packages/server/demo/AGENTS.md).

## Personas

| Persona | Role | Id | Use it to |
|---|---|---|---|
| `viewer` | user | `00000000-0000-7000-8000-000000000002` | browse, comment, subscribe, keep playlists and history |
| `creator` | creator | `00000000-0000-7000-8000-000000000001` | upload and edit in the studio, answer comments, read analytics |
| `moderator` | moderator | `00000000-0000-7000-8000-00000000000b` | work the comment report queue |
| `admin` | admin | `00000000-0000-7000-8000-00000000000a` | categories, screening approvals, Bull Board |

The rest of the users are fans and the owners of the other channels (Garden Signal, Harbor Journal, Paper Archive
and so on, depending on `--channels`). Sign in with `make demo-login PERSONA=<name>`; it prints a token, a `curl`
line and a console one-liner that sets the `vp.session` cookie for both apps.

## What is in it (default minimal profile)

| Thing | Count | Notes |
|---|---|---|
| Users, channels | 12, 12 | four owners have a bio, a brand colour, an avatar and a banner |
| Videos | 8 seeded, plus the two from `pnpm db:seed` | all READY; two are Shorts; one unlisted, one private |
| Comments | about 35 | threads with replies, a pinned and a hearted comment |
| Reactions, subscriptions | about 41, 23 | |
| Playlists, history, searches | 16, 9, 3 | |
| Captions | about 9 tracks | generated WebVTT, no speech model needed |
| Reports | 2 | the moderator queue is not empty |
| Featured shelves | per channel | |

`--profile full` (24 videos, 30 users, 8 channels) adds the services that need models and live ingest.

## A ten-minute tour

1. **Browse.** Open http://localhost:5173. The feed lists the seeded videos; `/shorts` is the vertical player.
2. **Watch.** Open a video: adaptive HLS with the 480p rung (the demo clips are 640 by 360), captions in the player
   menu, the transcript, comments with a pinned one, related videos.
3. **Channel.** Open `/@demo-creator`: banner, avatar, featured shelf, playlists, subscribe as the viewer.
4. **Search.** Search for a word from a title; the tabs split videos, channels and playlists.
5. **Sign in as the creator.** `make demo-login PERSONA=creator`, paste the snippet on http://localhost:5174.
   Library, analytics, comment inbox, upload.
6. **Upload.** Upload `tests/fixtures/s15.mp4` (`pnpm gen-video` makes it) in the studio and watch the status move
   through the pipeline, live, over SSE.
7. **Moderate.** Sign in as the moderator and open the reported comments.
8. **Operate.** Open Bull Board at http://localhost:3000/admin/queues with the `x-admin-token` header, and
   http://localhost:3000/docs for the API reference. With `--observability`, Grafana is at http://localhost:3001.
9. **Break it.** `make chaos-kill` kills a worker mid-transcode and asserts the video still reaches READY once.

## Extend the seed

The seed is a list of scenarios in `packages/server/demo/src/seed/scenarios/index.ts`, run in order.

1. Add the data to the world: `src/seed/world-*.ts` build a pure, deterministic `WorldSpec` from the options and the
   seeded PRNG (`rng.ts`); word banks are in `catalog.ts`. Use the PRNG, never `Math.random` or the clock.
2. Add a scenario file in `src/seed/scenarios/`: `{ name, essential, needsReady, requires, run }`. `requires` lists
   `METHOD /path/{param}` entries the committed contract (`packages/universal/api-contracts/openapi.yaml`) must
   contain; a missing one skips the scenario. `run` looks each thing up before creating it and returns
   `{ status, detail }`, with counts like `3 created, 5 already there`.
3. Register it in `scenarios/index.ts` after the scenarios it depends on.
4. Write the spec beside it in `__tests__/` against the in-process fake API (`fake-api.ts`), including the
   second-run-adds-nothing case.
5. Run it for real: `make demo-seed` twice; the second run must report `0 created`.
6. A new demo scenario for a feature, a new seed entity or a new service updates this page and
   [GETTING_STARTED.md](GETTING_STARTED.md) in the same PR.

Not in scope for the seed: timestamps in the past, view counts, live streams, watch parties and webhooks (no public
route sets them). Features owned by a ticket that has not merged are skipped, not faked.

## Reset

`make demo-reset` wipes the volumes and the state and seeds again; `make demo-reset ARGS="--purge-media"` also
regenerates the clips.
