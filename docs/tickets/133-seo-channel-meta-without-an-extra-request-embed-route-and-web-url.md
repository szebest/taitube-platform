# 133: SEO follow-ups - channel meta without an extra request, an embed route for the player card, and VITE_WEB_URL in the env schema

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 63 - Video SEO on the SSR render |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD ADR-21](../SDD.md#adr-21--modern-frontend-framework-react-19--tanstack-start-ssr--tanstack-router-no-nextjs) |

**Status:** ready

> **Why.** [63](63-tanstack-router-start-ssr-seo-streaming.md) merged with three gaps, which moved here so 63 and the tickets it blocks can close.

## What to build

- **Channel `ItemList`.** `channel.$channelId.tsx` loads the channel's videos in the loader only to feed `videoItemList`, an extra request for meta. Read them from a query the page already needs, or drop the list from the meta.
- **Embed route.** `twitter:card=player` and `og:video` need a page that plays the video on its own; there is no embed route. Add it as a server-rendered route with the player and nothing else, and point the card at it.
- **`VITE_WEB_URL`.** The web and studio configs read it, but it is not declared in `packages/server/env-schema`, which `env-key-closure.test.ts` expects to hold every key. Declare it, mirror it in `.env.example`, and update the SDD env table.

## Acceptance criteria

- [ ] `head()` reads the loader's query; the server makes no extra request for meta, on the channel page too.
- [ ] Raw server HTML of `/watch/<id>` contains the Twitter player card and `og:video`, both pointing at an embed route that renders the player alone.
- [ ] `VITE_WEB_URL` is declared in `env-schema`, present in `.env.example`, and `env-key-closure.test.ts` passes.
- [ ] `pnpm typecheck`, `pnpm lint` and the touched packages' tests pass, with output in the PR.

## Out of scope

- Oembed and a script-based embed snippet.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
