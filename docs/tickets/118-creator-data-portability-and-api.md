# 118: Creator data portability and API - exports, personal access tokens and a developer page

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 38 - User identity · 39 - Permissions · 42 - Threaded comments · 43 - Views buffer and creator analytics · 60 - Creator studio dashboard · 65 - Playback telemetry · 77 - Platform integrations and webhooks · 95 - Design system 2 · 98 - Realtime user event stream · 113 - Channel comment moderation · 117 - Channel team roles |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** A creator's data lives only in the studio's screens: there is no way to take the numbers or the comments into a
> spreadsheet, to automate a chore (tag a batch, hold a keyword, read last night's views) or to leave with their data. The
> only programmable surface is [77](77-platform-integrations-oembed-embed-player-webhooks.md)'s outgoing webhooks, which have
> no UI, and every other API call needs a browser session.

> **Builds on, does not redo.** Webhooks, their events and the HMAC signature are 77's (this ticket adds two events and a
> management page, nothing about delivery); the analytics numbers are [43](43-high-scale-video-views-buffer-reconciler.md)'s,
> [65](65-first-party-video-playback-telemetry-analytics-beacon.md)'s and [114](114-creator-stats-on-the-watch-page.md)'s;
> comments and their moderation state are [42](42-threaded-comments-keyset-pagination-moderation.md)'s and
> [113](113-channel-comment-moderation.md)'s; roles and the audit log are [117](117-channel-team-roles.md)'s; the studio shell
> is [60](60-creator-studio-dashboard-video-management-ui.md)'s. Sessions and their hardening stay
> [56](56-frontend-universal-auth-session-security.md)'s.

## What to build

### 1. Exports

- Table `data_exports` (`id`, `channel_id`, `requested_by`, `kind`, `params` jsonb, `format` `csv | json`, `status` `queued |
  running | ready | failed | expired`, `object_key`, `row_count`, `expires_at`, `created_at`). `kind` is a literal union in
  `@vp/domain`, one member per dataset, each with its row schema in `@vp/api-contracts`:
  - `video_analytics`: per video and day, views and watch seconds, from the daily table, any range the data covers, plus
    the first-48-hour hourly rows of [114](114-creator-stats-on-the-watch-page.md) and the retention curve;
  - `channel_analytics`: per day, views, watch seconds, subscribers gained and lost counts;
  - `comments`: every comment on the channel's videos, with target, author handle and display name (the public identity
    only), text, time, parent, hearts, pinned and moderation state (published or held); never an email or an account id;
  - `videos`: metadata, tags, category, visibility, chapters, counts and timestamps;
  - `posts`: [120](120-community-posts-and-threads.md)'s posts with poll results.
- `POST /v1/me/channel/exports { kind, params, format }`, `GET /v1/me/channel/exports` and `GET .../:id` (a presigned GET
  for a ready file), `DELETE .../:id`. One running export per channel, 10 a day, at most 1,000,000 rows or 500 MB.
- An `export` job in the existing worker pulls rows by keyset, writes them to a temp file through a streaming writer (RFC 4180
  CSV, or one JSON array), uploads to the private `exports/{channelId}/{id}` prefix and deletes the temp file, so memory stays
  bounded whatever the size; idempotent per export id and `PermanentError` for a bad request. The file expires after 7 days
  and housekeeping purges it. The CSV writer prefixes a cell that begins with `=`, `+`, `-`, `@` or a tab with an apostrophe,
  because a comment is attacker-controlled text and the file will be opened in a spreadsheet.
- Done is announced on [98](98-realtime-user-event-stream.md)'s stream and as a webhook event `export.ready`.
- Authorization (Rule 8): `create` and `read` on `ChannelExport`, through 117's existing rows: owner and manager every
  kind, the analytics role the analytics kinds only, nobody else; every request is recorded in 117's audit log.

### 2. Personal access tokens

- Table `api_tokens` (`id`, `user_id`, `channel_id`, `name` up to 60, `prefix` (8 characters, shown), `secret_hash` (SHA-256
  of 32 random bytes, compared in constant time), `scopes` text[], `expires_at`, `last_used_at`, `revoked_at`, `created_at`;
  up to 10 active per user). The token is shown once as `tt_pat_{prefix}_{secret}` and never again; expiry is 30 days, 90 days
  (default) or 1 year, never unlimited.
- **Scopes** are a literal union in `@vp/domain` (`API_SCOPES`): `videos:read`, `videos:write` (metadata, chapters, visibility,
  bulk edit; no upload), `analytics:read`, `comments:read`, `comments:moderate`, `posts:write`, `exports:read`,
  `exports:create`, `webhooks:manage`. A token never exceeds its user: the effective ability is the **intersection** of the
  scope's actions and what the user's own role on the token's channel allows (117), computed in one place in
  `@vp/permissions` that filters the built ability, so a demoted or removed member's token loses the access on the next call.
- **Using one**: `Authorization: Bearer tt_pat_...` on any existing route its scopes cover; no new routes. A request carrying
  both a token and a session cookie is a 400. Tokens never manage tokens, change the handle or ownership, invite members,
  delete the channel or sign in anywhere, and token requests get no CORS headers (a token does not belong in a browser).
  Each token is rate limited per id (60 requests a minute, `@fastify/rate-limit`), and `last_used_at` and a per-day request
  count are kept for the page below.
- Writes by a token are recorded in 117's audit log with the member and the token id, so "who changed this" is never "a
  script". `POST`, `GET` and `DELETE /v1/me/api-tokens` manage them; the secret exists only in the create response.
- Local-first: nothing to sign up for, nothing leaves the machine; verification is a hash lookup.

### 3. Webhooks that scripts can use

77's `/v1/me/webhooks` gets the scope `webhooks:manage` and two events added to its union: `export.ready` and `comment.held`
([113](113-channel-comment-moderation.md); the payload carries ids and the channel, never the comment text). Delivery,
signing and retries are 77's untouched.

### 4. Studio: the developer page

`/developers` in the studio, in the sections the studio uses for settings (each with its own save): **Tokens** (a `DataTable`
of name, scopes as `Badge`s, last used, expiry and Revoke; a "Create token" `Dialog` with name, expiry `Select`, a scope
list of `Checkbox`es grouped by what they touch, a `Callout` that the secret is shown once and a copy `Button`),
**Webhooks** (the list over 77's endpoints, create with the events as `Checkbox`es, the secret shown once, a "Send test"
`Button`), **Exports** (a `Dialog` to request a kind, format and range; a table of exports with live status, Download and
Delete) and **API reference** (a link to the OpenAPI document the repo already commits and a copy-ready `curl` example per
scope, generated from the contracts). New kit parts, specified under `docs/design/` and built here: `SecretReveal` (a
show-once field with copy and an acknowledged-saved gate) and `ScopePicker`. The rest is 95's `DataTable`, `Dialog`, `Field`,
`Select`, `Checkbox`, `Badge`, `Callout`, `Toast`, `Progress` and `EmptyState`.

## Delivery

One stack of three slices:

1. Exports: the table, the job, the writers, the endpoints and the role rows.
2. Tokens: the table, scopes, the intersection in `@vp/permissions`, bearer auth, rate limit, audit and the webhook events.
3. The `/developers` page.

## Acceptance criteria

- [ ] A creator requests a comments export as CSV and as JSON for a channel with 100,000 comments; the worker's memory stays
      bounded, the file downloads before it expires, and a row never contains an email or an account id.
- [ ] A comment beginning with `=cmd` is exported as text, not as a formula.
- [ ] An analytics-role member can export analytics and gets a 403 on comments; an editor or a moderator gets a 403 on
      exports; a second export while one runs is refused.
- [ ] A token with `analytics:read` reads analytics and gets a 403 on a comment delete; with `videos:write` it edits a video
      and the audit log names the member and the token; a token of a removed member stops working on the next request.
- [ ] A token is shown once; an expired, revoked or malformed token is a 401; a request with a token and a cookie is a 400; a
      token request has no CORS headers and is limited at 60 a minute.
- [ ] A token cannot create tokens, change the handle, invite a member or delete the channel whatever its scopes.
- [ ] A webhook registered by a token receives `export.ready` with a valid signature when an export finishes.
- [ ] `/developers` creates and revokes tokens, manages webhooks and requests exports, and meets the polish bar
      ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `privilege-escalation.test.ts` gains rows for exports, tokens and the scope intersection.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- OAuth, third-party apps, a consent screen and any hosted identity provider (a creator's own scripts are the use case).
- Downloading media files, a full channel takeout archive, and importing data from another service.
- Uploading through a token, and subscriber lists (the people behind the counts are not the creator's data to export).
- A GraphQL surface or an SDK beyond the existing `@vp/api-client`.

## Testing plan

- Domain: `it.each` tables over the scope-to-ability intersection per role, the token format and expiry, and the CSV writer
  (quoting, newlines, formula guard).
- Worker: the export job over a large fixture with a memory bound, idempotency, expiry purge and a failing row source.
- Routes: contract tests per endpoint, the 401 and 403 matrix over tokens and roles, the cookie and token conflict, rate
  limiting, no CORS headers on token requests.
- Studio: `renderRoute` specs for the developer page sections and the show-once secret.
- E2E: create a token in the studio app, call the API with it, request an export and download it.

## Open questions

- Decided: a token is a constrained copy of one user, never more than they can do, so removing a member needs no token hunt.
- Decided: a token is never unlimited and is never usable from a browser, so a leaked one ages out and cannot be replayed by a
  page.
- Decided: commenters appear in exports by public handle and display name only, because the creator is entitled to the
  discussion on their channel and not to the commenters' accounts.
- Decided: no upload by token in this ticket, because multipart upload state is a separate surface.
- Decided: `comment.held` carries ids only, so a webhook target never receives a viewer's text.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1, §6.2 and §11 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
