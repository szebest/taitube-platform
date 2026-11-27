# 144: Invitee accept from the studio - pending invites, accept and decline, and leaving a team

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M |
| Blocked by | 117 - Channel team roles |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** done

> **Why.** [117](117-channel-team-roles.md) ships invites, accept and decline as endpoints (`POST /v1/invites/:id/accept`, `POST /v1/invites/:id/decline`), but the invitee has no way to reach them from the UI: the studio has no page that lists the caller's pending invites, and the `team_invite` notification does not carry the invite id. The same gap hides leaving a team: `DELETE /v1/me/channel/members/:userId` lets a member remove themselves, and nothing in the studio calls it.

## What to build

### 1. API

- `GET /v1/me/invites` returns the caller's pending, unexpired invites: invite id, channel (id, handle, display name, avatar), role, inviter display name and `expiresAt`. Keyset-paged like the other lists, in `@vp/api-contracts`, the committed OpenAPI document and SDD §6.1.
- The `team_invite` notification payload carries the invite id, so a notification opens the invite directly. The kind and its grouping are 117's; this only adds the field to the payload and its contract.

### 2. Studio

- An invites panel reachable from the notification and from the studio's navigation while the caller has a pending invite: each row shows the channel, the role with its one-line description from the matrix, the inviter and the expiry, with accept and decline.
- Accept refreshes the memberships so the channel switcher lists the channel at once; a closed, expired or revoked invite shows its reason from the error code and drops out of the list.
- A leave-team control for a member of a channel they do not own, in the switcher's menu or on `/team`, behind a confirmation `Dialog`; the owner has none. After leaving, the studio returns to the caller's own channel.
- Rendered through `useCan` and the existing role table; no inline id or role comparison (Rule 8).

## Acceptance criteria

- [ ] `GET /v1/me/invites` lists only the caller's pending, unexpired invites; another user's, a declined, revoked or expired invite never appears.
- [ ] The `team_invite` notification carries the invite id and opens the invites panel on it.
- [ ] An invitee accepts from the studio and the channel switcher lists the channel with their role without a reload.
- [ ] An invitee declines from the studio and the invite leaves the list.
- [ ] A member leaves a team from the studio and loses access on the next request; the owner has no leave control.
- [ ] The panel and the leave control have their loading, empty, error and no-access states and pass axe in their dom specs.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` and `pnpm gen:contracts` (no diff) green, with output in the PR.

## Out of scope

- Email invitations to people without an account (117).
- Inviting from anywhere but `/team`.
- A combined switcher for accounts, owned channels and member channels ([129](129-multiple-accounts-and-channels.md)).

## Testing plan

- Route contract tests for `GET /v1/me/invites`, including the filters above.
- Studio `renderRoute` specs for the panel, accept, decline and leave.
- E2E: invite, accept from the studio, switch to the channel, leave.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §6.1 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
