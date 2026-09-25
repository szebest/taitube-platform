# 63: Video SEO on the SSR render - route meta, OpenGraph, player cards, JSON-LD, sitemap and RSS

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#63](https://github.com/szebest/taitube-platform/issues/63) |
| Size | M |
| Blocked by | 58 - Modern browse layout · 59 - Modern watch page · 89 - TanStack Start foundation |
| Blocks | 77, 86 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Ticket 85 note — SSR correctness depends on this.** Any formatter reading an ambient locale produces
> different bytes in the Node render and the browser hydration. `@vp/intl` takes the locale and the reference
> instant as arguments for exactly this reason; pass the negotiated locale into `IntlProvider` rather than
> letting it read `navigator`. Locale negotiation, `<html lang>` and `hreflang` are [86](86-localisation-rollout-locale-negotiation-rtl.md).

## What to build

SEO on top of the SSR [89](89-web-tanstack-start-foundation.md) already renders. The router, loaders,
dehydration and streaming are 89's; the framework choice is recorded in
[SDD ADR-21](../SDD.md#adr-21--modern-frontend-framework-react-19--tanstack-start-ssr--tanstack-router-no-nextjs).
Every page's data is already in the query cache during the server render because its loader calls
`queryClient.ensureQueryData(...)`, so `head()` reads the same query: no `createServerFn` per page.

1. **Route `head()` meta** for watch, feed and channel routes: title, description, canonical URL.
2. **OpenGraph and Twitter player cards** on `/watch/$videoId`: `og:type=video.other`, `og:title`,
   `og:description`, `og:image` (poster), `og:video` (HLS master URL, `application/x-mpegURL`),
   `twitter:card=player` with width and height.
3. **`VideoObject` JSON-LD** on the watch page (thumbnail, upload date, ISO 8601 duration, interaction
   counts), and `ItemList` of `VideoObject` on feed and channel pages.
4. **`/sitemap.xml` and `/feeds/videos.xml`** as TanStack Start server routes listing public READY videos.

Search and playlist pages own their loaders and meta in [74](74-frontend-multi-resource-search-discovery-ui.md)
and [73](73-frontend-youtube-playlists-library-player-queue.md).

## Acceptance criteria

- [ ] Raw server HTML of `/watch/<id>` (no JavaScript executed) contains the title, OpenGraph tags, Twitter
      player card and a `VideoObject` JSON-LD block that validates against the schema.org shape.
- [ ] Feed and channel pages render their own title, description and JSON-LD in the server HTML.
- [ ] `head()` reads the loader's query; the server makes no extra request for meta.
- [ ] `/sitemap.xml` and `/feeds/videos.xml` return valid XML listing only public READY videos.
- [ ] A private or missing video renders no OpenGraph tags and the not-found page.

## Out of scope

- Static site generation, and meta for studio, admin or settings routes.
- `<html lang>` and `hreflang`: [86](86-localisation-rollout-locale-negotiation-rtl.md).

## Testing plan

- Server render specs per route asserting the tags and JSON-LD in the HTML string.
- Server route specs for sitemap and feed with a stubbed API.

## Definition of Done

- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint` green.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
