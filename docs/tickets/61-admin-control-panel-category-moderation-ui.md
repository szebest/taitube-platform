# 61: Administrator control panel — dynamic category manager, queue health & moderation UI

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#61](https://github.com/szebest/taitube-platform/issues/61) |
| Size | M |
| Blocked by | 37 — Admin category API · 39 — Declarative RBAC · 55 — Modern design system · 56 — Frontend auth |
| Blocks | 62, 75 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

## What to build

A real production video platform requires administrative control to manage global content taxonomy, review flagged or problematic videos, and inspect the operational health of background queues.

This ticket delivers the **Taitube Admin Control Panel** (`/admin`):
1. **Dynamic Category Management (`/admin/categories`) with TanStack Table & TanStack Form**:
   - Web UI for Ticket 37 admin endpoints (`POST/PATCH/DELETE /v1/admin/categories`).
   - Category table built with `@tanstack/react-table` v8 (sorting, drag-and-drop sort order reordering).
   - Category creation/editing modal powered by `@tanstack/react-form` + `@tanstack/zod-form-adapter` validating slug, title, description, and display order.
   - Deactivate / toggle active state or delete empty categories.
2. **Platform Content Moderation (`/admin/moderation`) with TanStack Table**:
   - Global video browser across all users built with `@tanstack/react-table` v8 with multi-column filtering and sorting.
   - Administrative action overrides: force visibility to `private`, mark status as `REJECTED`, or delete offensive videos.
   - Comment moderation queue: review and delete reported comments with TanStack Table list.
3. **Queue Health & Worker Overview (`/admin/queues`)**:
   - Embedded Bull Board link and quick metrics widget (queue depths for probe, transcode, thumbnails, DLQ poison pill count).
4. **Security & Route Guards**:
   - Strict frontend role gate requiring `user.role === 'ADMIN'`.
   - Automatic redirection with 403 error toast for unauthorized users.

## Acceptance criteria

- [ ] `/admin` route tree protected by strict `ADMIN` role check.
- [ ] Category Manager UI:
  - List all active and inactive categories using `@tanstack/react-table`.
  - Modal form powered by `@tanstack/react-form` for creating and editing category metadata with Zod validation.
  - Delete category with dependency check warning if videos are attached.
- [ ] Content Moderation UI:
  - Search and filter videos across the entire platform via `@tanstack/react-table`.
  - One-click takedown / rejection button with audit reason prompt.
- [ ] Queue Health overview displaying active BullMQ queue counts.
- [ ] Non-admin access attempt redirects to `/` with access denied notification.
- [ ] Component tests verifying admin permission gates, TanStack Table sorting, and TanStack Form interactions.

## Out of scope

- Direct automated user banning (IP/email bans).

## Notes for the implementer

- Ensure cache invalidation toasts notify the admin that changes to categories update the public frontend immediately.
- Enforce strict <= 250 lines rule per component/hook.

## Testing plan

- Role test: Attempt to navigate to `/admin` as normal user -> assert redirect to `/`.
- Admin test: Navigate as Admin -> create category -> assert category shows up in public header.

## Definition of Done

- [ ] `pnpm --filter @taitube/web test` and `pnpm --filter @taitube/web typecheck` pass.
- [ ] Admin panel functional in development environment.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
