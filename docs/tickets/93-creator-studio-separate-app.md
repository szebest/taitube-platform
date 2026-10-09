# 93: Creator Studio as its own app (apps/client/studio), served and deployed separately

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 92 - Apps grouped by tier · 53 - Frontend data layer · 54 - Frontend testing infrastructure · 55 - Design system · 75 - Playwright E2E suite · 83 - Granular container topology |
| Blocks | 48, 56, 57, 58, 60, 61, 64, 65, 68, 69, 70, 72, 76, 78 |
| Spec | [SDD ADR-11 Repository topology](../SDD.md#adr-11--repository-topology-modular-monorepo-multiple-deployables-one-worker-image) · [SDD ADR-21 Frontend framework](../SDD.md#adr-21--modern-frontend-framework-react-19--tanstack-start-ssr--tanstack-router-no-nextjs) · [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23--package-runtime-tiers-the-directory-is-the-tier) · [SDD §11 Security](../SDD.md#11-security) · [SDD §12.1 Compose](../SDD.md#121-rung-1--docker-compose-local-dev-phase-02) · [SDD §12.2 Kubernetes](../SDD.md#122-rung-2--kubernetes-locally-kind-or-k3d-phase-3) · [SDD §12.3 Cloud](../SDD.md#123-rung-3--cloud-reference-deployment-phase-4) |

**Status:** blocked

> **Priority: next.** Start as soon as the open PRs (#131, #133, #134, #135, #136, #132 and the deps PR) are
> merged, before any new FE ticket, to avoid big merge conflicts. [92](92-apps-grouped-by-tier.md) goes first,
> because 93 depends on it. Every ticket that adds creator or admin screens (56, 60, 61, 65, 72, 76, 78) is
> blocked by 93, so nothing new lands in the old location. So is every FE ticket that would otherwise open the
> moment the stack merges (57, 58, 64, 68, 69, 70): they build on the code 93 moves into packages, and this
> keeps the frontier at 92, then 93, then the rest.

> **Why.** YouTube serves its creator tools as a separate app (studio.youtube.com): its own bundle, its own
> deploy, its own release cadence. Here the creator surface lives inside the viewer app, so every viewer
> downloads the route tree for upload and editing, and every creator change redeploys the viewer. The studio
> work queued behind this (60 library and analytics, 61 admin, 72 channel customisation, 76 live, 78 Discord)
> would make that worse each time.

## What to build

### 1. The app

- `apps/client/studio`, package `@vp/studio`, a TanStack Start app on the same stack as `apps/client/web`
  (React 19, Vite, file-based TanStack Router with a committed `routeTree.gen.ts`, TanStack Query, SSR).
- Dev port `5174`: `dev`, `vite preview` and `start` all serve it there, the way web serves `5173`. Root
  `pnpm dev` starts it next to web, api and worker.
- Its own `src/config`, parsed with Zod, the only reader of `import.meta.env`: `VITE_API_BASE_URL` (as web),
  `VITE_WEB_URL` (where "view on Taitube" links go, default `http://localhost:5173`). Web gets
  `VITE_STUDIO_URL` (default `http://localhost:5174`) the same way. `.env.example` documents both next to
  `VITE_API_BASE_URL`.
- `robots.txt` disallows everything and no studio route has SEO meta: studio pages are private tools.

### 2. What moves from web to studio

The creator surface that exists today moves with `git mv` (history kept); nothing is redesigned, that is 60's
job.

| Today in `apps/client/web` | In `apps/client/studio` |
|---|---|
| `/upload` and `/upload/edit/$videoId` (routes under `_authed/upload/`) | the same paths under the studio's `_authed` layout |
| the legacy upload and edit pages (`src/modules/Upload/`, whatever 53 and 55 left of it) and 53's `features/upload/` | `src/modules/Upload/` and `src/features/upload/`, unchanged |
| creator-only hooks and form validators 53 added for editing (`use-update-video`, `use-delete-video`, `video-field-validators`) when web has no other consumer | `src/features/videos/` |

- Studio's `/` redirects to `/upload` until 60 adds `/videos`. Its root layout is plain markup: logo, account,
  a link back to web. 60 builds the real studio shell.
- Web keeps redirects, not pages: `/upload` and `/upload/edit/$videoId` answer with a redirect to the same path
  on `VITE_STUDIO_URL`, on the server render and on client navigation. The header's upload entry links to the
  studio.
- Web's production build contains no upload or edit code (a bundle guard row on web's build).

### 3. Shared code goes into client-tier packages, never into a copy

The rule: a module both apps import after the split moves into a package; a module one app uses stays in, or
moves with, that app. No `shared`, `common` or `utils` package. The PR carries the table of every module it
moved and its consumers.

Expected outcome (the PR confirms or corrects it against the code 53, 54, 55 and 75 actually merged):

| Package | Tier, layer | Holds | Comes from | Owner |
|---|---|---|---|---|
| `@vp/ui` (`packages/client/ui`) | client, the lowest layer its edges allow | 55's primitives, `cn`, the design tokens CSS, the theme provider and theme cookie, the logo | `src/components/ui/`, `src/layout/components/logo/` | [55](55-design-system-tailwind-radix-dark-theme.md) |
| `@vp/permissions-react` | client, T3 | `useCan`, `<Can>`, `PermissionsProvider` | `src/hooks/use-can.ts`, `src/components/can.tsx` | [81](81-casl-declarative-permissions-refactor.md) |
| `@vp/forms` | client, above `@vp/ui` | 53's TanStack Form set-up and field components (`useAppForm`, text, select, file fields, `validateWith`) | `src/integrations/form/` | [53](53-frontend-architecture-modernization-tanstack-query.md) |
| `@vp/queries` | client, T5 (new layer, below) | the `QueryClient` factory and its SSR wiring, the API client wiring and today's auth seam, keyset paging, the query and mutation factories both apps call (video detail, categories, account) | `src/integrations/{query,api,auth}/`, the shared parts of `src/features/*/api/` | 53 |
| `@vp/security-headers` | client, T1 | the CSP nonce and the security-headers request middleware each app mounts from its `start.ts` | `src/integrations/security/` | [75](75-fullstack-e2e-playwright-security-perf-validation.md) |
| `@vp/web-testing` | client, devDependency | the contract-typed MSW handlers and `renderRoute`, which takes the app's router factory | `src/__tests__/` helpers and `msw/` | [54](54-frontend-testing-trophy-vitest-msw-integration-suite.md) |
| `@vp/vite-preset` (`packages/server/vite-preset`) | server (runs in Vite, in Node), build tooling | the TanStack Start and React plugin set-up, the workspace source aliases, the bundle guard with per-app budgets | `apps/client/web/vite/`, `vite.config.ts` | [89](89-web-tanstack-start-foundation.md) |

- Each package is small and has an `AGENTS.md` (plus the `CLAUDE.md` symlink) naming its owner and what does
  not belong in it.
- Strings stay in `@vp/messages`, under a `studio.` key prefix for studio copy; no catalogue per app.
- The 55 theme cookie carries a `Domain` from `VITE_COOKIE_DOMAIN` when it is set (cloud), so the theme
  follows the user between the two hosts. Empty locally, where a cookie already spans ports.

### 4. Each app owns its gates

Both apps get the same set, written once and pointed at each app, not copied:

- the route tree drift check in CI (one step over `apps/client/*`, not a second step per app);
- the bundle guard on every build, from `@vp/vite-preset`;
- the CSP and security headers on every HTML response, from `@vp/security-headers`;
- a Vitest unit and jsdom project (92's `apps/*/*/vitest*.config.ts` glob picks it up);
- a Playwright project: each app owns its `playwright.config.ts` and `e2e/`. 75's upload flow moves to the
  studio's suite, the headers and XSS specs run against both apps (`it.each` over the two origins), and the
  stack fixture (it starts the in-process API, server code) moves out of `apps/client/web/e2e/` into a root
  `tests/` module both suites import.
- Architecture rows that name `apps/client/web` today (`local-first`, `frontend-vocabulary`,
  `no-adhoc-formatting`, `lockfile-closure`, `esm-specifiers`, `zero-matches-web-rows`, `entrypoints`) cover
  `apps/client/*`, from one list of client apps.
- A new architecture spec fails when a source file under one client app is byte-identical to one in the
  other, so a copy shows up in CI rather than in review.

### 5. Served and deployed separately

- **Image:** a `studio` target in 83's root `Dockerfile` and `docker-bake.hcl`, built like `web` (pruned to
  `@vp/studio`, served by `srvx`), `images.yml` builds it. `scripts/bundle-app.sh` handles client apps by one
  branch, not a copy of the `web` one.
- **Compose:** a `studio` service on `5174` with the same health check as `web`, behind its own profile in 83's
  stack topology, so a creator-side change starts only what it needs.
- **Kubernetes:** `infra/k8s/base/studio.yaml` (Deployment and Service) in the base and both overlays, and a
  host rule for `studio.localhost` on the existing ingress (browsers resolve `*.localhost` to loopback). Web
  keeps the `/` catch-all.
- **Cloud:** a `studio.<domain>` hostname on the `cloudflared` tunnel and its DNS record in
  `infra/terraform`, next to `api.<domain>` and `cdn.<domain>`.
- **CORS:** `CORS_ORIGINS` gains `http://localhost:5174` in the `@vp/env-schema` default, `.env.example` and
  the SDD env table. Until [56](56-frontend-universal-auth-session-security.md) the browser calls the API
  directly from both origins.

## Acceptance criteria

- [ ] `pnpm --filter @vp/studio dev` serves the studio on `:5174` with HMR; `build` and `start` serve the SSR
      build there; root `pnpm dev` starts it.
- [ ] `/upload` and `/upload/edit/<id>` work on the studio as they did on web; `git log --follow` on the moved
      upload page shows its history.
- [ ] On web, `/upload` and `/upload/edit/<id>` redirect to the studio, on server render and client
      navigation (route specs); web's production bundle has no upload or edit chunk (bundle guard).
- [ ] Web links to the studio through `VITE_STUDIO_URL` and the studio back through `VITE_WEB_URL`; each app's
      `src/config` is its only `import.meta.env` reader.
- [ ] Every package in the table exists with its tier from its directory and a declared layer, or the PR
      records why a row changed; `pnpm boundaries` green; no client package depends on a server package.
- [ ] The duplicate-file architecture spec is green, and red on a planted copy.
- [ ] Each app: the route tree drift check runs in CI, the bundle guard runs on its build, every HTML response
      carries the CSP and security headers (75's headers spec over both origins), and its Playwright suite
      passes (`upload` in the studio's, browse and watch in web's).
- [ ] A preflight from `http://localhost:5174` is allowed by the API (spec next to 49's preflight spec).
- [ ] `docker buildx bake studio` builds `vp-studio:local`; the compose `studio` service is healthy under its
      profile; `make smoke-offline` passes; `scripts/validate-k8s.sh` accepts the new manifests and the
      ingress routes `studio.localhost` to it on k3d; `terraform validate` (90's CI job) passes.
- [ ] The studio's `robots.txt` disallows all.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:architecture`, `pnpm knip`,
      `pnpm knip --production` and `pnpm boundaries` green.

## Out of scope

- The studio shell, video library, metadata editor, upload dialog and analytics:
  [60](60-creator-studio-dashboard-video-management-ui.md).
- The admin panel: [61](61-admin-control-panel-category-moderation-ui.md), which builds it inside the studio.
- Cookie sessions, sign-in and sign-out across both apps: [56](56-frontend-universal-auth-session-security.md).
- Channel customisation: [72](72-frontend-settings-customization-system.md).
- A third client app. The layout and packages here make one cheap, but nothing asks for it yet.

## Notes for the implementer

- Do the `git mv` of the upload pages and the package extractions as their own commits, apart from the new
  files, so a reviewer can see the moves at R100.
- Until 56, each app reads the dev token from `localStorage` on its own origin, and `localStorage` is
  per-origin even across ports: paste the token into each app once. 56 removes it.
- 83's `SSR_API_BASE_URL` applies to the studio's SSR server the same way; read it in the studio's
  `src/config` as web does.

## Open questions

- Decided: a separate origin, not a path prefix. Locally the studio is `localhost:5174`, on k3d
  `studio.localhost`, in cloud `studio.<domain>`. It matches how the reference deployment already splits
  hosts (`api.<domain>`, `cdn.<domain>`, SDD §12.3), and it keeps the two apps apart where it matters: 68's
  service worker on web's origin can never intercept studio navigations, each app has its own CSP, and a
  script on one origin cannot read the other's storage. A `/studio` prefix behind one host would need a
  router `basepath`, a Vite `base` and an ingress rule just to share an origin we do not need to share.
- Decided: the cost of two origins is small and owned. CORS lists both origins until 56; after 56 the browser
  talks to its own app server and CORS no longer matters for either. The session cookie is one cookie for
  both apps: `SameSite=Lax` already treats `studio.<domain>` and `<domain>` as the same site, and its
  `Domain` comes from `VITE_COOKIE_DOMAIN` (empty locally, where cookies span ports anyway). 56 implements it;
  signing out of either app signs out of both.
- Decided: the admin panel lives in the studio, behind an admin role, not in its own app. It is the same kind
  of tool (tables over videos, 44's admin overrides next to the creator's own controls, the same layout), the
  `canAccessAdmin` guard already exists in `@vp/permissions`, and it keeps admin code out of the viewer
  bundle. If it ever needs its own deploy, `routes/_authed/admin/` moves out as one folder.
- Decided: a new layer for shared app modules. `@vp/queries` depends on `@vp/api-client` (T4), so it is T5,
  and T5 is "Application, no library may depend on these" today. The layers become T5 app modules, T6
  applications, T7 reference tools: `vp.layer` changes in the app manifests and `@vp/upload-client`, and
  ADR-23 and `packages/AGENTS.md` §2 say so in this PR.
- Decided: `@vp/vite-preset` is a `server` package (Vite config runs in Node) and joins `@vp/tsconfig` and
  `@vp/testing` in `check-boundaries.ts`'s `BUILD_TOOLING`, the devDependencies a client app may take
  regardless of tier because they ship nothing into a bundle.
- Decided: the seven new packages stay separate, none is consolidated into another: `@vp/ui`, `@vp/forms`,
  `@vp/queries`, `@vp/permissions-react`, `@vp/security-headers` and `@vp/web-testing` (client), and
  `@vp/vite-preset` (server). Each has one owner ticket and a different consumer set, so merging any of them
  would pull a dependency into an app that does not need it.
- Decided: shared TanStack queries are their own package, `@vp/queries`, not a folder in `@vp/api-client`, on
  the new layer above it (next bullet). `@vp/api-client` stays the typed HTTP client with no React or query
  dependency.
- Decided: 93 keeps blocking 57, 58, 64, 68, 69 and 70 (and every ticket that adds creator or admin screens),
  even though they are web-side. They build on the code 93 moves into packages, and the frontier stays 92,
  then 93, then the rest.
- Decided: the dev port is `5174`, the next one Vite picks after `5173`; nothing in the repo uses it.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `ARCHITECTURE.md`, `docs/SDD.md` (ADR-11 deployables, ADR-21, ADR-23 layers, §11 origins and cookies,
      §12 topologies, §15.1 tree, the `CORS_ORIGINS` row), `README.md`, `apps/client/web/AGENTS.md`, a new
      `apps/client/studio/AGENTS.md` and the root `AGENTS.md` directory index updated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
