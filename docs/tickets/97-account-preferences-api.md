# 97: Saved preferences - one account endpoint for appearance, playback, privacy and notifications

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 38 - User identity · 39 - Permissions |
| Blocks | 72, 99 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** in-progress

> **Why.** The settings area ([72](72-frontend-settings-customization-system.md)) saves every preference to the
> device at once, so it works signed out and renders on the server without a flash. A signed-in viewer expects
> the same look, playback defaults and privacy choices on their next device. Privacy and notification choices
> also have to be server data, because the server acts on them.

## What to build

One preferences document per account, read and written through one endpoint, with sections the web app
merges into its device preferences.

### 1. Data

- Table `user_preferences` in `@vp/db`: `user_id` (primary key, `on delete cascade`), `appearance`, `playback`,
  `privacy`, `notifications` (each `jsonb`, nullable), `version` (integer), `updated_at`. One migration.
- A repository in `@vp/core/repositories` with its postgres and in-memory implementations, each in its own file.

### 2. The contract

In `@vp/api-contracts`, one Zod schema per section, all fields optional so a client sends only what changed:

| Section | Fields |
|---|---|
| `appearance` | `theme`, `mode`, `accent`, `contrast`, `overrides` (one entry per token group): the shape of 95's `AppearancePreference`. Theme and set ids are strings (pattern and length checked); the server does not know the registry, and the client drops an id its registry no longer offers |
| `playback` | default quality, speed, autoplay next, hover preview, captions on and language, stats overlay |
| `privacy` | `historyPaused`, default playlist visibility (the existing `Visibility`), subscriptions visible |
| `notifications` | uploads from subscriptions, replies and mentions, processing finished |

| Endpoint | What |
|---|---|
| `GET /v1/me/preferences` | the document with `version` and `updatedAt`; an account with none gets every section `null` |
| `PATCH /v1/me/preferences` | a partial document plus the `version` it was based on; merges section by section; a stale `version` is a conflict with the current document in the problem body |

Both in the committed OpenAPI document (`pnpm gen:contracts`) and SDD §6.1; any new error code in `@vp/errors`
and SDD §6.2.

### 3. Rules and service

- Pure rules in `@vp/validation` for the field shapes; the service composes them and returns a `Result`
  (Rule 14); the route unwraps through `sendResult`.
- The owner check is a `@vp/permissions` rule (`update` on the account's own preferences), never a hand check.
- **The server honours what it stores**: the watch-history write path skips a write while `historyPaused` is
  true, and the notification producers read `notifications` before they enqueue (a producer that does not
  exist yet reads it when it lands).

## Acceptance criteria

- [ ] A signed-in viewer's `PATCH` of `appearance.overrides.spacing` is returned by the next `GET` on another
      session, with `version` incremented.
- [ ] A `PATCH` with a stale `version` returns the conflict with the current document; nothing is written.
- [ ] Sections the request leaves out are untouched; a field set to `null` clears it.
- [ ] With `historyPaused` true, watching a video writes no history entry.
- [ ] Anyone but the owner gets a 403 through the permissions rule; `privilege-escalation.test.ts` gains the row.
- [ ] An unknown theme or set id is stored as sent (within the pattern) and does not fail the request.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- The settings pages and the merge into device preferences: [72](72-frontend-settings-customization-system.md).
- Email delivery of notifications.

## Notes for the implementer

- The video metadata edit already does optimistic locking on `version` ([19](19-videos-api-completion-openapi.md));
  follow its conflict shape.
- Keep each section's schema next to the others in one contracts file, so 72's client store and this endpoint
  read one definition.

## Testing plan

- Rules: one `it.each` table per section over valid and invalid fields.
- Repositories: the shared contract suite over postgres and in-memory.
- Routes: contract tests for `GET`, partial `PATCH`, the conflict, the 403.
- History: a service spec proving a paused account writes nothing.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §6.1 (and §6.2 if a code was added) updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
