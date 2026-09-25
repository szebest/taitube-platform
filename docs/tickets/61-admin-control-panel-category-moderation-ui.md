# 61: Administrator control panel — dynamic category manager, queue health & moderation UI

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#61](https://github.com/szebest/taitube-platform/issues/61) |
| Size | M |
| Blocked by | 37 - Admin category API · 39 - Declarative RBAC · 53 - Frontend data layer · 55 - Design system · 56 - Frontend auth · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 89.** A new page: no legacy module to replace. It uses 89's route structure, 53's query and form
> setup and 56's `_authed` layout.

## What to build

Routes under `apps/web/src/routes/_authed/admin/`, feature code in `apps/web/src/features/admin/`.

### 1. Guard

- The `admin` layout route's `beforeLoad` evaluates `canAccessAdmin` from `@vp/permissions`
  against the user in router context and redirects to `/` with an access denied toast when it fails. The check
  runs on the server render too, so a non-admin never receives admin HTML.
- Actions inside the panel render through `useCan` (`canManageCategory`, `canDeleteVideo`, `canDeleteComment`). No `role === 'ADMIN'`
  anywhere in the web app.

### 2. Categories `/admin/categories`

- TanStack Table over every category, active and inactive, with sort and drag-to-reorder of display order.
- Create and edit in a dialog with TanStack Form (slug, title, description, display order), validated by the
  `@vp/validation` category rules.
- Toggle active, delete an empty category; deleting one with videos attached shows the count and asks first.
- Mutations invalidate the public categories query, so the browse pills update without a reload.
- Backend: [37](37-admin-category-management-cached-api.md) (`POST/PATCH/DELETE /v1/admin/categories`).

### 3. Moderation `/admin/moderation`

- TanStack Table over every user's videos with column filters and sort; filters live in `validateSearch`.
- Admin overrides: force private, reject, delete, each with a reason prompt. The override endpoints are
  [44](44-creator-studio-video-management-visibility.md)'s; this section waits for them.
- Reported comments queue with delete, once the API has a report endpoint (none today; the slice waits for it).

### 4. Queues `/admin/queues`

- The DLQ list and count from `GET /v1/admin/dlq` ([16](16-retries-dlq-admin-replay-reprocess.md)) and a link to
  Bull Board ([10](10-bull-board-admin-auth.md)). Per-queue depth needs a small admin endpoint that does not
  exist yet; add it to `apps/api` in this ticket or leave depth to Bull Board.

## Acceptance criteria

- [ ] `/admin/*` redirects a non-admin to `/` with an access denied toast, on server render and on client
      navigation; the guard is a `@vp/permissions` check in `beforeLoad`.
- [ ] Category table lists active and inactive categories, sorts, and reorders by drag.
- [ ] Category dialog creates and edits with `@vp/validation` rules; deleting a category with videos warns
      with the count.
- [ ] A category change shows up in the public category pills without a reload.
- [ ] Moderation table filters and sorts across all videos, with filters in the URL; takedown and reject ask for
      a reason.
- [ ] Queue overview shows the DLQ count and links to Bull Board.
- [ ] Integration specs for the guard, table sorting and the category form, through 54's `renderRoute` with MSW.

## Out of scope

- Banning users by IP or email.

## Testing plan

- Guard: a normal user navigating to `/admin` lands on `/`.
- Admin creates a category, the public category query refetches and the new pill renders.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Admin panel works in local dev.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
