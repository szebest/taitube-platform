# 63: TanStack Router & TanStack Start SSR — SEO, dynamic OpenGraph & video streaming metadata

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#63](https://github.com/szebest/taitube-platform/issues/63) |
| Size | L |
| Blocked by | 62 — Frontend performance & virtualization |
| Blocks | 64, 66, 75, 77 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

### Architectural Decision: Why TanStack Router / TanStack Start instead of Next.js?

| Framework | Architecture & Ecosystem | Streaming & Edge | Lock-in & Overhead | Verdict |
|---|---|---|---|---|
| **Next.js (App Router)** | Vercel-centric server actions, heavy React Server Components magic, fragile bundling outside Vercel | Complex caching rules, slow HMR in large monorepos | Heavy vendor lock-in, hard to run local-first without Node server | **Rejected** |
| **TanStack Router + TanStack Start** | 100% type-safe routing, built-in loaders, seamless TanStack Query integration, standard Vite build | Blazing fast streaming SSR, zero vendor lock-in | Lightweight, native Vite 6, full client/server control | **Accepted (Recommended)** |

Search engine web crawlers (Googlebot, Bing, Twitter/X, Discord, Telegram) require server-rendered HTML and OpenGraph meta tags to properly index video pages and generate rich link cards.

This ticket delivers modern, high-performance SSR and SEO powered by **TanStack Router / TanStack Start**:
1. **100% Type-Safe Routing (`@tanstack/react-router`)**:
   - File-based routing with automatic route tree generation (`routeTree.gen.ts`).
   - Strict path param and search param validation via Zod schemas (`/watch/$videoId`, `/search?q=...&category=...`).
   - Loader-based pre-fetching: video data and comments pre-fetched before route transition to eliminate layout waterfalls.
2. **Server-First Fetching Architecture with TanStack Start (`createServerFn`)**:
   - All public, discovery, and playback routes run **Server-First SSR**:
     - **Home Feed (`/`):** Server function `fetchFeedServerFn` prefetches initial category videos during SSR.
     - **Watch Page (`/watch/$videoId`):** Server function `fetchVideoDetailServerFn` fetches video metadata, channel profile, and initial comment batch on the server.
     - **Search (`/search`):** Server function `fetchSearchResultsServerFn` performs server-side search matching and renders polymorphic results directly into the initial HTML.
     - **Channel Profile (`/channels/$handle`):** Server function `fetchChannelServerFn` renders creator header, tabs, and video grid on the server.
     - **Playlists (`/playlist`):** Server function `fetchPlaylistServerFn` pre-renders playlist hero card and ordered video queue.
   - **Dehydration & Streamed HTML:** Server loaders call `await queryClient.prefetchQuery(...)`. State is serialized into the streaming HTML payload and rehydrated on the client with 0 duplicate HTTP requests.
   - Fast streaming: HTML shell with `<head>` tags and critical visual structure streams to client with TTFB < 100ms.
3. **Complete Video SEO & Structured Data (TanStack Head)**:
   - Dynamic OpenGraph tags: `og:type=video.other`, `og:title`, `og:description`, `og:image` (high-res poster), `og:video` (HLS master URL), `og:video:type=application/x-mpegURL`.
   - Twitter Player Cards (`twitter:card=player`, `twitter:player:width`, `twitter:player:height`).
   - Google Rich Snippets schema markup: Valid `schema.org/VideoObject` JSON-LD with thumbnail, upload date, duration (ISO 8601 `PT12M45S`), and interaction statistics.
4. **Automated Dynamic Sitemap & RSS Feed**:
   - `GET /sitemap.xml`: Generates XML sitemap of all public READY videos for search engine indexing.
   - `GET /feeds/videos.xml`: Atom / RSS feed for video syndication.

## Acceptance criteria

- [ ] `@tanstack/react-router` and TanStack Start (`@tanstack/react-start`) integrated into `apps/web` with Vite 6.
- [ ] Server functions (`createServerFn`) implemented for Feed, Watch Page, Search, Channel Profile, and Playlists.
- [ ] Route loaders prefetch queries on the server; client hydration executes with 0 redundant initial network fetches.
- [ ] Server-rendered HTML inspection confirms watch page, feed, and search contain rendered video titles and cards without client JavaScript.
- [ ] Route parameters strictly validated using Zod (`/watch/$videoId`).
- [ ] SSR pre-fetching configured: Video watch page renders complete HTML with meta tags on initial response.
- [ ] Validated OpenGraph tags and Twitter Player card output for all public videos.
- [ ] Validated `VideoObject` JSON-LD schema rendered in `<head>` conforming to Google Search Central specifications.
- [ ] Dynamic HTML streaming response verified: initial shell arrives under 100ms TTFB.
- [ ] Automated `/sitemap.xml` endpoint serving dynamic sitemap for search crawlers.
- [ ] Unit & crawler simulation tests verifying meta tags and JSON-LD output without JavaScript execution.

## Out of scope

- Static Site Generation (SSG) for user-specific studio or admin pages.

## Notes for the implementer

- ISO 8601 duration converter: Convert duration in milliseconds to `PT#M#S` format for the `VideoObject.duration` schema property.
- Ensure all crawler requests (`User-Agent: Googlebot|Twitterbot|facebookexternalhit`) receive full static meta tags.

## Testing plan

- Headless curl test: Fetch `/watch/:id` with `curl -s` and assert `og:title`, `og:video`, and `<script type="application/ld+json">` are present in raw HTML.
- Rich snippet test: Validate output against Google Rich Results Test schema validator.

## Definition of Done

- [ ] SSR and type-safe routing pass all tests under `pnpm --filter @taitube/web test`.
- [ ] Google Search Console / Rich Results test returns 0 errors.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
