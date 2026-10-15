# AGENTS.md — @vp/studio (Creator Studio)

Instructions for any coding agent working on the Taitube creator studio (`apps/client/studio`): the creator
surface (upload, edit, and the library, analytics and admin panel the tickets after 93 add), served and deployed
apart from the viewer app.

> Owner: ticket [93](../../../docs/tickets/93-creator-studio-separate-app.md) · the shell, library and editor:
> [60](../../../docs/tickets/60-creator-studio-dashboard-video-management-ui.md) · the admin panel: [61](../../../docs/tickets/61-admin-control-panel-category-moderation-ui.md)

---

## 1. The same stack as web

Everything in [apps/client/web/AGENTS.md](../web/AGENTS.md) applies here: TanStack Start over Vite 8 and React 19,
file routes under `src/routes/` with a committed `src/routeTree.gen.ts`, TanStack Query filled by loaders, TanStack
Form, the `#app/` import alias, the design system from `@vp/ui`, the two Vitest projects and the Playwright suite in
`e2e/`. Its rules (declarative authorization, the API client from router context, rules from packages, formatting
through `@vp/intl-react`, nothing phones home, one spec per source, MSW typed by the contracts) hold here word for
word. This file lists only what differs.

`apps/client/studio` is **tier `client`, layer T6**, like web. It depends on the same client packages; a module both
apps need lives in one of them, never in a copy (`tests/architecture/client-app-duplicates.test.ts` fails a source
file byte-identical between the two apps).

## 2. What differs

| Concern | Studio |
|---|---|
| Origin | `http://localhost:5174` for `dev`, `vite preview` and `start`; `studio.localhost` on k3d, `studio.<domain>` in cloud (SDD §11, §12) |
| Config | `src/config` is the only reader of `import.meta.env`: `VITE_API_BASE_URL` and `SSR_API_BASE_URL` as web reads them, plus `VITE_WEB_URL` (default `http://localhost:5173`), where the viewer app is |
| Routes | `/` redirects to `/upload`; `/upload` and `/upload/edit/$videoId` under the `_authed` layout; nothing public |
| Shell | `src/layout/studio-shell.tsx`: the logo, the account, the theme menu and a link back to web, plain markup until 60 builds the real shell |
| Guests | `_authed` is `ssr: false` (the token lives in `localStorage` until 56) and renders a sign-in prompt linking to web instead of an outlet; nothing redirects to a public page, because the studio has none |
| Search engines | `public/robots.txt` disallows everything and `__root.tsx` sets `robots: noindex, nofollow`; no studio route carries SEO meta |
| Copy | studio strings live in `@vp/messages` under the `studio.` prefix (`packages/universal/messages/src/en/studio.ts`); the moved legacy pages keep their literals until 60 |
| Styles | `src/studio.css` sets the body on the design tokens; the moved legacy forms keep Bootstrap and plain CSS modules, with no SCSS and none of web's `src/styles/` |
| Legacy pages | `src/modules/Upload/` and `src/features/upload/`, moved from web unchanged: mechanical edits only, 60 redesigns them |

## 3. Local commands

```bash
pnpm --filter @vp/studio dev         # Vite dev server with HMR on http://localhost:5174; root `pnpm dev` starts it too
pnpm --filter @vp/studio build       # dist/client and dist/server; regenerates src/routeTree.gen.ts
pnpm --filter @vp/studio start       # serves the build on http://localhost:5174
pnpm --filter @vp/studio test
pnpm --filter @vp/studio typecheck   # tsconfig.json (the app), tsconfig.spec.json (specs and vite.config.ts)
```

The API's `CORS_ORIGINS` default allows `http://localhost:5174`. Until 56 each app reads the dev token from its own
origin's `localStorage`: paste it into the studio once, as into web.

## 4. Also read

- [apps/client/web/AGENTS.md](../web/AGENTS.md) — the stack and the rules, which this app shares
- [packages/AGENTS.md](../../../packages/AGENTS.md) — tiers, layers and what a client app may depend on
- [docs/standards/testing.md](../../../docs/standards/testing.md)
