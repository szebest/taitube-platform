# 61: Administrator control panel — dynamic category manager, queue health & moderation UI

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#61](https://github.com/szebest/taitube-platform/issues/61) |
| Size | M |
| Blocked by | 37 - Admin category API · 39 - Declarative RBAC · 53 - Frontend data layer · 55 - Design system · 56 - Frontend auth · 89 - TanStack Start foundation · 91 - Web import aliases · 93 - Creator Studio as its own app · 95 - Design system 2 |
| Blocks | 101, 112 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** ready

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 93.** The admin panel lives in the studio app (`apps/client/studio`, its own origin), behind the
> admin role, not in the viewer app and not in an app of its own ([93](93-creator-studio-separate-app.md)
> records why). A new page: no legacy module to replace. It uses the studio's route structure, `@vp/queries` and
> `@vp/forms`, and 56's `_authed` layout.

> **Data sources.** The reported comments queue is [103](103-comment-hearts-reports-creator-inbox.md)'s admin report endpoints; Pick of the day curation is a page [101](101-pick-of-the-day-curation.md) adds to this admin area.

## What to build

Routes under `apps/client/studio/src/routes/_authed/admin/`, feature code in `apps/client/studio/src/features/admin/`.
The pages sit in [60](60-creator-studio-dashboard-video-management-ui.md)'s `StudioWorkspace` and are built
from 95's studio and states patterns ([95](95-design-system-2.md) section 6,
[docs/design/README.md section 8, Studio](../design/README.md#studio)): tables on the `DataTable` shell,
dialogs, confirmations and reason prompts on `@vp/ui`'s `Dialog`, and every empty queue or list on
`EmptyState`.

### 1. Guard

- The `admin` layout route's `beforeLoad` evaluates `canAccessAdmin` from `@vp/permissions`
  against the user in router context and redirects to the studio's `/` with an access denied toast when it fails. The check
  runs on the server render too, so a non-admin never receives admin HTML.
- Actions inside the panel render through `useCan` (`canManageCategory`, `canDeleteVideo`, `canDeleteComment`). No `role === 'ADMIN'`
  anywhere in either app.

A redirect out of `beforeLoad` on the server render is a 307 with no HTML, so a toast queued on the router
context is lost. Carry the message on the redirect itself (a search param the root reads, or a flash cookie)
and have the root show it; the context toaster only covers client navigation.

### 2. Categories `/admin/categories`

- TanStack Table over every category, active and inactive, rendered through `DataTable`, with sort and
  drag-to-reorder of display order on the `SortableList` primitive from 95.
- Create and edit in a `Dialog` with TanStack Form (slug, title, description, display order), validated by the
  `@vp/validation` category rules.
- Toggle active, delete an empty category; deleting one with videos attached shows the count and asks first.
- Mutations invalidate the studio's categories query. The browse chip bar is in the web app, another origin: they
  show the change on their next fetch, through 37's cache invalidation on the API side, not a cross-app
  query invalidation.
- Backend: [37](37-admin-category-management-cached-api.md) (`POST/PATCH/DELETE /v1/admin/categories`).

### 3. Moderation `/admin/moderation`

- TanStack Table over every user's videos through `DataTable`, with column filters and sort; filters live in
  `validateSearch`.
- Admin overrides: force private, reject, delete, each with a reason prompt. The override endpoints are
  [44](44-creator-studio-video-management-visibility.md)'s; this section waits for them.
- Reported comments queue with delete, once the API has a report endpoint (none today; the slice waits for it).

### 4. Queues `/admin/queues`

- The DLQ list and count from `GET /v1/admin/dlq` ([16](16-retries-dlq-admin-replay-reprocess.md)) and a link to
  Bull Board ([10](10-bull-board-admin-auth.md)). Per-queue depth needs a small admin endpoint that does not
  exist yet; add it to `apps/server/api` in this ticket or leave depth to Bull Board.
- An empty DLQ renders `EmptyState` ("Nothing failed"); a failing DLQ request renders `SectionError` with retry
  while the rest of the page stays.

### Smart wrappers

Over the studio's `DataTable`: `CategoryTable` in `features/admin/components/`. Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/studio/README.md#smart-wrappers-the-studio-needs); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Acceptance criteria

- [ ] The studio's `/admin/*` redirects a non-admin to the studio's `/` with an access denied toast, on server
      render and on client navigation; the guard is a `@vp/permissions` check in `beforeLoad`.
- [ ] Category table lists active and inactive categories, sorts, and reorders by drag.
- [ ] Category dialog creates and edits with `@vp/validation` rules; deleting a category with videos warns
      with the count.
- [ ] A category change shows up in the studio's category table without a reload, and in web's category chips
      on their next load.
- [ ] Moderation table filters and sorts across all videos, with filters in the URL; takedown and reject ask for
      a reason.
- [ ] Queue overview shows the DLQ count and links to Bull Board.
- [ ] `features/admin/` defines no table, dialog, skeleton or state component of its own; an empty category
      list, moderation queue or DLQ renders `EmptyState` with at most one action.
- [ ] Drag-to-reorder has a keyboard path (pick up with Space, move with arrows, drop with Space), announced to
      a screen reader.
- [ ] Every destructive confirmation names the item and its consequence, puts focus on Cancel, and uses the
      `danger` button variant.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] Integration specs for the guard, table sorting and the category form, through 54's `renderRoute` with MSW.

## Out of scope

- Banning users by IP or email.

## Testing plan

- Guard: a normal user navigating to the studio's `/admin` lands on the studio's `/`.
- Admin creates a category, the studio's categories query refetches and the new row renders.

## Definition of Done

- [ ] `pnpm --filter @vp/studio test` and `pnpm typecheck` pass.
- [ ] Admin panel works in local dev.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
