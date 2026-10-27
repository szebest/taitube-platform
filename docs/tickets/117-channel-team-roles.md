# 117: Channel team roles - invite managers, editors, moderators and analytics viewers

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 38 - User identity · 39 - Permissions · 44 - Creator studio video management · 81 - CASL permissions refactor · 93 - Creator Studio as its own app · 95 - Design system 2 · 99 - Notifications |
| Blocks | 113, 114, 115, 116, 118, 120, 121, 122, 129 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** A channel is one user today: every `@vp/permissions` rule on a video, comment, playlist or analytics
> resource compares the caller with the owner ([comment.rules.ts](../../packages/universal/permissions/src/rules/comment.rules.ts)
> has `videoOwnerId: user.id`), and the only other actors are the platform-wide roles from
> [39](39-declarative-rbac-abac-permission-engine.md) (`MODERATOR`, `ADMIN`), which act on every channel. A creator
> cannot hand a colleague the studio, or a volunteer the comment queue, without sharing a login.

> **Order with 113.** This ticket ships first. It owns membership, the role matrix and the channel audit log;
> [113](113-channel-comment-moderation.md) writes its moderation actions into that log and ships the moderator role's
> comment actions on top of this matrix, so "channel moderators" exist once.

## What to build

### 1. Data

- Table `channel_members` in `@vp/db`: `channel_id`, `user_id`, `role` (`manager`, `editor`, `moderator`,
  `analytics`), `invited_by`, `created_at`; primary key `(channel_id, user_id)`. The channel's owner is not a row:
  ownership stays `channels.user_id`, so a channel always has exactly one owner and cannot be left without one.
- Table `channel_invites`: `id`, `channel_id`, `invitee_user_id`, `role`, `invited_by`, `created_at`, `expires_at`
  (14 days), `status` (`pending`, `accepted`, `declined`, `revoked`, `expired`); one pending invite per
  `(channel_id, invitee_user_id)`.
- Table `channel_audit_log`: `id` (UUIDv7), `channel_id`, `actor_user_id`, `action` (a literal union in `@vp/domain`),
  `target_type`, `target_id`, `meta` (jsonb, small, no free text from other users), `created_at`; index
  `(channel_id, created_at desc, id desc)`. Moderation rows carry `meta.disclosure` (`silent` or `visible`) and a ban its `expiresAt`. Append-only: no update or delete route, housekeeping purges rows older
  than 365 days.
- Repository interfaces in `@vp/core/repositories`, postgres and in-memory, each in its own file (Rule 5).

### 2. Roles and the permission matrix

This ticket owns the one role model: [113](113-channel-comment-moderation.md)'s moderators are the `moderator` role below, and no other ticket defines a role or a moderator list. The roles are data in `@vp/domain` (`CHANNEL_ROLES` with the actions each carries); the rules in `@vp/permissions`
read it, so the matrix is single-sourced and the studio renders its role picker from the same table.

| Action | owner | manager | editor | moderator | analytics |
|---|---|---|---|---|---|
| read analytics, stats and analytics exports | yes | yes | yes | no | yes |
| edit videos, upload, thumbnails, visibility, link content ([122](122-linked-content-graph.md)) | yes | yes | yes (delete: no) | no | no |
| edit the channel page and identity ([115](115-channel-page-customisation.md), [121](121-channel-page-builder.md)) | yes | yes | yes | no | no |
| `pin` a comment or a thread | yes | yes | no | yes | no |
| `pin` a post or a Start here video; create, schedule and delete posts ([120](120-community-posts-and-threads.md)) | yes | yes | yes | no | no |
| `heart` a comment ([103](103-comment-hearts-reports-creator-inbox.md)) | yes | yes | no | no | no |
| comment moderation: hold, approve, hide, remove, shadow ban, ban and lift, each silent or visible ([113](113-channel-comment-moderation.md)) | yes | yes | no | yes | no |
| change comment settings, blocked words, saved replies, link policy and approve inbound links | yes | yes | no | no | no |
| exports of comments, videos and posts, webhooks ([118](118-creator-data-portability-and-api.md)) | yes | yes | no | no | no |
| invite, change a role, remove a member, read the audit log | yes | yes (not other managers) | no | no | no |
| delete the channel, transfer ownership | yes | no | no | no | no |

The table is complete for the tickets above: they use its rows and add none. A later ticket that adds an action adds its
row here, in the same table, in its own PR.

- Rules are CASL conditions on the resource's channel (`channelId`), added beside the owner rules in
  `video.rules.ts`, `comment.rules.ts`, `playlist.rules.ts`, `channel.rules.ts` and `analytics.rules.ts`; the
  caller's memberships come in on `UserContext` once per request (a role map `channelId -> role`), so a rule never
  queries. No route, service or component compares a user id or a role (Rule 8).
- The platform `MODERATOR` and `ADMIN` rules are untouched; a channel moderator never gains anything outside their
  channel.
- A member acts as themselves: every video, comment and edit keeps the member's own `user_id`, and the audit log
  shows the member, never "the channel".

### 3. API

| Endpoint | Who | What |
|---|---|---|
| `GET /v1/me/channel/members` | owner, manager | members and pending invites |
| `POST /v1/me/channel/invites` | owner, manager | `{ handle, role }`; notifies the invitee through [99](99-notifications.md) (kind `team_invite`, added to 99's union here) |
| `DELETE /v1/me/channel/invites/:id` | owner, manager | revoke |
| `POST /v1/invites/:id/accept`, `POST /v1/invites/:id/decline` | the invitee | accept creates the member row in one transaction |
| `PATCH /v1/me/channel/members/:userId` | owner, manager | change role |
| `DELETE /v1/me/channel/members/:userId` | owner, manager, or the member themselves | remove or leave |
| `GET /v1/me/memberships` | signed in | the channels the caller works on, with their role, for the studio's channel switcher |
| `GET /v1/me/channel/audit` | owner, manager | keyset, filter by actor and action |

- Studio requests act on a channel through an `X-Channel-Id` header validated against the caller's memberships (the
  default is the caller's own channel), so every existing `/v1/me/...` and `/v1/creator/...` route keeps its path.
- Rules in `@vp/domain-rules` return `Result` (Rule 14): the invitee exists and is not already a member, a manager
  cannot invite or change a manager, the owner cannot be removed, the invite is pending and unexpired. New error
  codes land in `@vp/errors` and SDD §6.2 in the same PR.
- Every state change (invite, accept, revoke, role change, removal, and the actions other tickets add) calls one
  `ChannelAuditService.record` inside the same transaction; the action union in `@vp/domain` is where tickets add
  theirs.
- Both endpoint groups are in `@vp/api-contracts`, the committed OpenAPI document and SDD §6.1.

### 4. Studio

- A `/team` page: a `DataTable` of members with role `Select` and remove, pending invites with revoke, "Invite"
  `Dialog` (handle field with `Command` lookup, role `SegmentedControl` with each role's one-line description from
  the matrix), a `Callout` explaining what the role can do.
- The audit log as a second tab on `/team` (`Tabs`): a list of rows with actor `Avatar`, action text, target and
  relative time, filters for actor and action, keyset "Load more".
- A channel switcher in `StudioWorkspace`'s navigation header (`DropdownMenu`) for a member of other channels; every
  route reads the active channel from one hook. [129](129-multiple-accounts-and-channels.md) replaces it with one switcher covering accounts, owned
  channels and these member channels; this one is the member half it builds on.
- Navigation and actions render through `useCan` against the active channel; a moderator sees only the comment inbox.
- New kit parts: `AuditLogList` and `RoleBadge` in the studio's kit ([architecture section 1](../design/architecture.md#1-five-layers));
  everything else is `DataTable`, `Dialog`, `Command`, `SegmentedControl`, `Select`, `Tabs`, `Callout`,
  `DropdownMenu`, `Avatar`, `Badge`, `EmptyState` from [95](95-design-system-2.md).

## Delivery

One stack of three slices:

1. Data, `CHANNEL_ROLES`, the `UserContext` memberships and the rule changes with the full matrix test; no endpoint.
2. Invites, members, memberships and audit endpoints, the notification kind, contracts and SDD.
3. Studio `/team`, the audit tab, the channel switcher and the `X-Channel-Id` plumbing.

## Acceptance criteria

- [ ] The matrix above holds: one generated test per action x role cell over `@vp/permissions`, plus the owner and an
      unrelated user, passes.
- [ ] An invited user sees a notification, accepts, and the studio's channel switcher lists the channel with their role;
      a revoked, declined or expired invite cannot be accepted.
- [ ] An editor edits a video on the channel and the audit log records the editor, not the owner; a moderator gets a
      403 on the same edit.
- [ ] A manager cannot invite a manager, change one, or remove the owner; the owner cannot be removed or demoted.
- [ ] A member removed mid-session loses access on the next request.
- [ ] The audit log is append-only: no route changes a row, and the 365-day purge is covered by a housekeeping spec.
- [ ] `privilege-escalation.test.ts` gains a row per new endpoint and per role.
- [ ] `/team` and the switcher meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Payments, memberships or paid seats.
- Fine-grained custom roles (the four are fixed; a creator cannot edit what a role may do).
- Ownership transfer between users and brand accounts that outlive their creator. Several owned channels per user and multiple
  signed-in accounts are [129](129-multiple-accounts-and-channels.md); transfer stays unscheduled.
- Email invitations to people without an account.

## Testing plan

- Rules: the generated action x role matrix, in `@vp/permissions`, one file per rule file (Rule 12).
- Domain rules: an `it.each` table over the invite and role-change failures.
- Repositories: the shared contract suite over postgres and in-memory.
- Routes: contract tests per endpoint including the 403s and the `X-Channel-Id` check.
- Studio: `renderRoute` specs for the team page, the invite dialog and the switcher.
- E2E: invite, accept, edit as editor, read the audit log as the owner.

## Open questions

- Decided: the owner stays `channels.user_id` and is not a member row, so a channel cannot be orphaned and no rule
  has to guard "the last owner".
- Decided: four fixed roles, no custom roles; the matrix is one table in `@vp/domain` and a creator who needs
  something else asks for a role, not a toggle.
- Decided: an account joins a channel only by invite from an existing account, so no email is sent and nothing
  leaves the machine (local-first).
- Decided: the platform `MODERATOR` role is not a channel role; it keeps its global reach for the admin panel
  ([61](61-admin-control-panel-category-moderation-ui.md)).

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
