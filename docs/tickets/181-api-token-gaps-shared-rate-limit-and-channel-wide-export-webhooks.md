# 181: API token gaps - a rate limit shared across API processes and export.ready for the whole channel

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S–M |
| Blocked by | 118 - Creator data portability and API |
| Blocks | — |
| Spec | [118 Creator data portability and API](118-creator-data-portability-and-api.md) · [117 Channel team roles](117-channel-team-roles.md) |

**Status:** ready

## What to build

Close the gaps the PR of ticket 118 listed as known ([#354](https://github.com/szebest/taitube-platform/pull/354)). Each was checked against the code on this branch; the first one turned out to be closed already.

1. **A token PATCHing the user's own videos on a team channel: not a gap now.** `withinScopes` in `packages/universal/permissions/src/token-scopes.ts` pins every `Video` grant to the token's channel (`pinnedToChannel`, an inverted rule on `channelId`), and `token-scopes.test.ts` has the row "team token edits no own video" expecting `false`. `token-scopes.ts` was last changed by [129](129-multiple-accounts-and-channels.md), after 118 merged. What is missing is a route-level proof: `apps/server/api/src/__tests__/api-token-flow.test.ts` only edits a video on the token's own channel. Add that one test, so the guarantee is held where a request enters, not only by the ability table.
2. **The token rate limit is per API process.** `tokenRateLimit` in `apps/server/api/src/plugins/token-rate-limit.ts` builds its limiter with `app.createRateLimit` from `@fastify/rate-limit`, registered in `apps/server/api/src/app.ts` with no `redis` option, so the count lives in each process's memory. With N API replicas a token gets up to N times `API_TOKEN_LIMITS.requestsPerMinute` (60), and a restart resets it. Back the limiter with the shared Redis, through a port and an adapter (rule 4: no `ioredis` in `apps/server/api`).
3. **`export.ready` reaches the owner's and the requester's webhooks only.** `export-stage.ts` announces to `new Set([ownerId, requestedBy])` through `createWebhookFanout`, whose `listSubscribed(ownerId, event)` is keyed on one user. The PR says "the owner's webhooks only"; the code also covers the member who asked for the export. A team member who holds `exports:read` but did not ask gets nothing, though they can download the file. Decide who should hear it and make the fanout say so.

Decided for 3: the owner and every member who may read exports on the channel (the same `ChannelExport` read ability from 117), because the file is channel data, not the requester's. Members without that ability stay out.

## Acceptance criteria

- [ ] A route test in `api-token-flow.test.ts`: a token for a team channel, holding `videos:write`, gets 403 or 404 (the one `decideVideoEditAccess` gives) on `PATCH /v1/creator/videos/:id` for the user's own video on another channel, and 200 on the token's own channel.
- [ ] The token limiter uses a store shared by all API processes; a test with two app instances over one in-memory store of the port shows 60 requests spread across them end in a 429 on the 61st, with the `Retry-After` the current limiter sends. Local-first holds: the in-memory adapter is the default in tests, Redis is the cloud and compose one.
- [ ] A token's limit survives an API restart within the same minute (covered at the adapter level against Redis in the integration suite).
- [ ] `export.ready` is delivered once per eligible member's subscribed webhook, never twice to one webhook when the owner is also the requester, and not to a member without export read; a worker test table covers owner, requester, other member with the ability, member without.
- [ ] `docs/SDD.md` describes where the rate limit state lives and who `export.ready` goes to; the 118 ticket's wording about "owner's webhooks" is corrected there if it appears.

## Setup & environment

None expected: the API already gets a Redis connection through the composition root. If the limiter needs a key prefix or a setting, it goes through `packages/server/env-schema` and `.env.example`.

## Out of scope

- Per-address limits of anonymous routes (a separate limiter).
- New token scopes, token UI, and other webhook events.
- Changing `API_TOKEN_LIMITS`.

## Notes for the implementer

- Raised in the body of [#354](https://github.com/szebest/taitube-platform/pull/354): "a token can still PATCH the user's own videos on a team channel, export.ready reaches the owner's webhooks only, the rate limit is per API process". Items 2 and 3 confirmed in code; item 1 is stale after 129 (see above).
- `@fastify/rate-limit` accepts a `redis` option, but passing an `ioredis` client from `apps/server/api` breaks rule 4. Look for the port the API already has for counters or Redis access before adding one, and put the adapter in `packages/server/adapters`.
- The audit log and the token's `last_used` write are separate from the limiter; do not couple them.

## Testing plan

Route test above, a contract test for the limiter port on both adapters, a worker test table for the fanout audience, an integration test of the shared limit against Redis.

## Open questions

- None.

## Definition of Done

- [ ] Merged; SDD updated; `gen-index.py` re-run.
