# 84: Result-typed error handling — domain code returns, the edge decides

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 82 — Architecture remediation, package runtime tiers & contract seams |
| Blocks | 85 |
| Spec | [SDD ADR-18 Error taxonomy](../SDD.md#adr-18-error-taxonomy-decides-retry-policy) · [SDD §6.2 Error codes](../SDD.md#62-error-codes-stable-machine-readable) · [SDD §6.4 Thin transport routes](../SDD.md#64-api-layer-architecture-thin-transport-routes-domain-services) · [SDD ADR-19 Hexagonal architecture](../SDD.md#adr-19-hexagonal-architecture-interface-segregation-and-modular-repository-boundaries) · [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23-package-runtime-tiers-the-directory-is-the-tier) |

**Status:** in-progress

> **Priority:** this ticket takes precedence over every other frontier ticket, including 83 and the Phase 5
> frontend work. Every ticket from 42 onward adds a domain service, and each one added before this lands is
> another service written in the pattern being replaced. The cost of this change is proportional to the number
> of services that exist when it starts.
>
> The status board shows this ticket as `blocked`, because ticket 82's `**Status:**` line still reads
> `ready-for-agent` while several of its workstreams are outstanding. The parts of 82 this ticket builds on —
> `@vp/api-contracts`, the package runtime tiers and `tests/architecture/` — are merged in `main` (PR #95);
> 82's remaining workstreams do not touch anything here. Start this one.

---

## Why this ticket exists

**A failure is not part of any signature in this repo.** `VideoService.get(user, id)` types as
`Promise<VideoDetailView>`. It can fail in three ways and the compiler knows about none of them. Adding a
fourth is a non-breaking change: every caller keeps compiling, and none of them handles it.

44 `throw` sites in `apps/api/src/services/` and 178 `catch` blocks across `apps/api` + `packages/server` are
the current error-handling design. It works — the Fastify handler in `apps/api/src/plugins/errors.ts` renders
anything carrying an `ErrorCodes` member as RFC 9457 — but it works by convention and runtime inspection, and
conventions are what this repo has already learned drift (ticket 82: *"nearly every defect in this repo is
something the repo already forbids in writing"*).

### The three things that are actually wrong

**1. The domain decides presentation.**
`apps/api/src/services/video-service.ts:127` throws `VIDEO_NOT_FOUND` because the row is absent.
`video-service.ts:144` throws **the same code** because CASL said the caller may not read it. A service three
layers below HTTP has decided that a private video should look like a missing one. That is a correct choice
for the public route and the wrong choice for an admin console, and there is no way for a second consumer to
choose differently — the distinction was destroyed at the throw site.

**2. `catch` is used as control flow, and it cannot tell intent from fault.**
`channel-service.ts:176` and `:191` swallow everything with `catch {}` to absorb a concurrent insert of the
same identity. A unique-violation and a dead Postgres connection are indistinguishable there; the second one
silently produces a channel-less user. `feed-service.ts:101` and `:110` do the same for the page cache, where
swallowing genuinely is correct — and nothing in the code, the types or the tests separates the two cases.

**3. The same validation is written twice, differently, and the browser gets the weaker copy.**
`apps/web` cannot import `apps/api/src/services/` and should not be able to (tier rule, ADR-23) — so every
rule the API applies is re-implemented in the browser or skipped. The upload form is the clearest case and the
worked example this ticket uses throughout:

| | Frontend | Backend |
|---|---|---|
| allowed types | `{ 'video/mp4': ['.mp4'] }` hardcoded at `apps/web/src/modules/Upload/components/video-form/upload/upload-video-form.tsx:23` | `ALLOWED_CONTENT_TYPES` at `apps/api/src/routes/uploads.ts:21` — **a different set** |
| size ceiling | **no check at all** | `maxUploadBytes` (5 GB default) at `routes/uploads.ts:62` |
| title | `required: true` | `z.string().optional()` in `StartUploadSchema`, then `title \|\| filename` |

A user picks a 6 GB file, waits for it to upload, and is told `UPLOAD_TOO_LARGE` at the end. The check that
would have told them in 5 ms exists — it is just on the wrong machine, and there is no package either side can
import it from. Worse, both backend checks sit **in the route**, which `apps/api/AGENTS.md` Rule 1 forbids
outright; they are there because there was nowhere better to put them.

Ticket 70 is currently scheduled to build a frontend error taxonomy by reading the wire format, because there
is nothing importable to build it from. The rule is universal; only the I/O around it is not.

### What this ticket does not claim

`@vp/errors` is a good taxonomy and `PROBLEM_STATUS` in `@vp/api-contracts` is already an exhaustive
`Readonly<Record<ErrorCode, number>>` — adding a code is a compile error until someone decides its HTTP status.
That is exactly the mechanism this ticket generalises. **No second error vocabulary is introduced.** The
discriminant of every typed failure *is* the existing `ErrorCode`.

---

## The shape

A service splits into halves that were never separated, plus an edge that was never given a choice.

| Layer | Lives in | Tier · layer | Needs | Returns |
|---|---|---|---|---|
| **1a. Validation** — is the submitted input well-formed and in bounds | `@vp/validation` | `universal` · T2 | **the input, nothing else** | `Result<T, wire-safe Failure union>` |
| **1b. Domain rules** — policy, invariants, state transitions | `@vp/domain-rules` | `universal` · T3 | input **+** an entity **+** policy | `Result<T, Failure union>` |
| **2. Services** — repository, cache, queue and storage coordination | `apps/api/src/services/`, `apps/worker/src/stages/` | `server` | ports and rules | `Result<T, union of rule + infra failures>` |
| **3. Edge** — the only place a `Result` is unwrapped | `apps/api/src/routes/`, `apps/worker/src/runner.ts`, later `apps/web` | `server` / `client` | HTTP, BullMQ, the DOM | a response, a throw at the queue boundary, a view state |

Layers 1 and 2 never log a failure, never format one and never `throw`. Layer 3 never contains a rule.

**1a and 1b are split by what a function needs to be callable at all**, and that decides how each is used:
validation runs **before any network call**, which is what makes optimistic form feedback possible and what
makes its failures safe to put on the wire. A domain rule needs an entity, so it runs once you hold one —
on the server after a repository read, or in the browser against a cached entity, which is what `<Can>`
already does today. Both are universal and both are pure; neither is "backend only".

```ts
// 1a — @vp/validation/src/uploads/start-upload.ts   (input only — the browser runs this before submitting)
export function validateStartUpload(
  input: StartUploadInput,
  limits: UploadLimits
): Result<StartUploadInput, StartUploadFailure> { … }

// 1b — @vp/domain-rules/src/videos/read-video.rule.ts   (needs the entity and the policy)
export type ReadVideoFailure = VideoNotFound | VideoForbidden;

export function decideVideoRead(input: {
  viewer: UserContext | null;
  video: Video | null;
  videoId: string;
}): Result<Video, ReadVideoFailure> {
  if (!input.video) return err(videoNotFound(input.videoId));
  if (!can(canReadVideo, { user: input.viewer, video: input.video }))
    return err(videoForbidden(input.videoId));
  return ok(input.video);
}

// 2 — apps/api/src/services/video-service.ts   (server, I/O, still no throw)
async get(
  viewer: UserContext | null,
  videoId: string
): Promise<Result<VideoDetailView, ReadVideoFailure | DatabaseUnavailable>> {
  const found = await this.videos.findWithDetails(videoId);   // Result<…, DatabaseUnavailable>
  return andThen(found, (details) =>
    map(decideVideoRead({ viewer, video: details?.video ?? null, videoId }), () =>
      toVideoDetailView(details, this.cleanCdnBase)
    )
  );
}

// 3a — apps/api/src/routes/videos.ts   (public: a private video is a missing one)
return sendResult(reply, request, await videoService.get(request.user, id));

// 3b — apps/api/src/routes/admin/videos.ts   (admin: tell the truth)
return sendResult(reply, request, await videoService.get(request.user, id), {
  on: { FORBIDDEN: (e) => problemFor(e, request.url, { status: 403 }) },
});
```

Same service. Two consumers. Two answers. The service was never asked to choose, and adding a fourth failure
mode to it is now a **compile error in both routes**.

---

## What to build

Nine workstreams. **Each lands as its own PR** on a shared `ticket/84-*` branch prefix. W1–W3 are additive and
break nothing; W4 is the largest mechanical diff and everything after it depends on its signatures; W9 is
documentation only.

---

### W1 — `@vp/result` (new package, `packages/universal/result`, tier `universal`, layer **T1**)

Written from scratch. **Not `neverthrow`** — a T1 universal package in this repo carries zero runtime
dependencies, must typecheck without `@types/node`, and must pass under both `vitest` and `bun test`; and the
combinator set here is 120 lines that we then own, version and shape to the `ErrorCode` discriminant.

```ts
export type Result<T, E> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };
```

- **Constructors:** `ok(value)`, `err(error)`.
- **Guards:** `isOk(result)`, `isErr(result)` — real type predicates that narrow.
- **Combinators:** `map`, `mapErr`, `andThen`, `unwrapOr`, `match`.
- **Async:** every async function returns `Promise<Result<T, E>>`. There is **no `ResultAsync` class** —
  `andThenAsync` / `mapAsync` take and return promises, and a plain `await` is always legal.
- **Aggregation:** `all(results)` → `Result<T[], E>` (first failure wins) for the fan-out call sites.
- **Boundary:** `tryCatch(fn, onThrow)` and `fromPromise(promise, onThrow)` — the *only* sanctioned `catch` in
  the repo outside an adapter. `fromThrowable(fn, onThrow)` returns a wrapped function for repeated use.
- **Exhaustiveness:** `assertNever(value: never, context: string): never`. The `default:` branch of any
  `switch` over a failure union calls it, so a new variant is a compile error at every consumer:

  ```ts
  default:
    return assertNever(failure, 'renderVideoFailure');   // failure satisfies never
  ```

  `match` is the combinator form of the same guarantee: its handler record is keyed by `E['code']` and is
  required to be total.

`@vp/result` knows nothing about `ErrorCode`, HTTP, or this domain. It is mechanism.

---

### W2 — Typed failure variants in `@vp/errors`, and one exhaustive map per edge

`@vp/errors` gains the variant vocabulary. It stays T1 universal, gains no dependency, and **keeps
`PermanentError` / `TransientError`** — they remain the queue-boundary representation (ADR-18), they are just
no longer how domain code communicates.

```ts
export type Failure<C extends ErrorCode, D extends object = Record<never, never>> =
  Readonly<{ code: C; message: string } & D>;

export type VideoNotFound      = Failure<'VIDEO_NOT_FOUND', { videoId: string }>;
export type VideoForbidden     = Failure<'FORBIDDEN', { videoId: string }>;
export type HandleTaken        = Failure<'HANDLE_ALREADY_TAKEN', { handle: string }>;
export type DatabaseUnavailable = Failure<'DATABASE_UNAVAILABLE', { operation: string }>;
```

The discriminant is `code`, whose type is a literal member of the existing `ErrorCode` union, so narrowing
through `map` / `andThen` / `switch` works and **no parallel taxonomy appears**. Bare `Error` and bare `string`
are not failure types anywhere.

Two exhaustive maps, both `Readonly<Record<ErrorCode, …>>`, so a new code fails to compile until both edges
have been told what it means:

| Map | Lives in | Answers |
|---|---|---|
| `PROBLEM_STATUS` *(exists)* | `@vp/api-contracts/src/problem.ts` | what HTTP status this code is |
| `RETRY_CLASS` *(new)* | `@vp/errors/src/retry-class.ts` | `'permanent' \| 'transient'` — ADR-18, single-sourced |

`RETRY_CLASS` replaces the throw-site judgement call that ADR-18 describes. The *classification* is a property
of the code and belongs with the code; the *decision to retry* stays at the queue boundary (W7).

New codes this ticket adds to `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and SDD §6.2:
`DATABASE_UNAVAILABLE` (503, transient), `CACHE_UNAVAILABLE` (503, transient), `QUEUE_UNAVAILABLE`
(503, transient), `INVALID_CURSOR` (400, permanent — today it is an untyped `InvalidCursorError`).

**Also here:** `problemFor(failure, instance, overrides?)` in `@vp/api-contracts` — one function turning any
`Failure` into a `Problem`. It is what `sendResult` (W6) calls, and what the Fastify backstop calls, so there
is exactly one renderer.

**Wire safety is a property of the package a failure comes from, not a per-field decision.** A
`@vp/validation` failure can only contain what the client already sent — the field name, the rejected value,
the limit it broke — so its payload is safe to return, and `problemFor` projects it into the `Problem.errors`
array the schema already has. A `@vp/domain-rules` or infra failure may carry ids, operation names or internal
state, so only its `code`, `title`, `status` and `detail` cross. Because the two live in different packages,
`problemFor` overloads on the **type** rather than consulting a document: this is what lets a form highlight
the offending field when the backend rejects a submission the browser let through, without ever leaking
`{ operation: 'findById' }` on a `DatabaseUnavailable`.

---

### W3 — Two universal rule packages: `@vp/validation` and `@vp/domain-rules`

| Package | Location | Tier · layer | Depends on | Holds |
|---|---|---|---|---|
| `@vp/validation` | `packages/universal/validation` | `universal` · **T2** | `@vp/result`, `@vp/errors` (both T1) | predicates over submitted input |
| `@vp/domain-rules` | `packages/universal/domain-rules` | `universal` · **T3** | `@vp/validation` (T2), `@vp/permissions` (T2), `@vp/domain` (T1) | policy, invariants, state transitions |

**Why two and not one folder-split package.** The distinction — input only, versus input plus an entity —
decides three things that a folder cannot enforce:

1. **Callability.** Validation runs before any network call, so a form can give feedback as you type. A domain
   rule needs an entity, so it runs after a read.
2. **Wire safety.** A validation failure can only contain what the client already sent, so W2 projects its
   payload into `Problem.errors`. A domain-rule failure may carry ids and internal state, so it does not.
   As two packages this is a **type**, checked by the compiler; as two folders it is a sentence in a document.
3. **What a consumer can reach.** The frontend's form layer depends on `@vp/validation` alone and therefore
   *cannot* import a rule that needs a fetch. That is the repo's own test for a package boundary
   (`packages/AGENTS.md` §5): a consumer wants one and not the other.

**T3 for `@vp/domain-rules`, not T2:** `@vp/permissions` and `@vp/validation` are both T2, and a T2→T2 edge is
the sibling violation `packages/AGENTS.md` §2 forbids. The layer is a design statement, so the answer is to
declare the rules a layer above the policy and the validation they compose, not to weaken the rule.

**Both packages are universal and both are pure.** Neither is "backend only": `apps/web` runs validation before
submitting and runs domain rules against entities already in its query cache — which is exactly what `<Can>`
and `canReadVideo` do in this repo today.

```
packages/universal/validation/src/          ← input only · wire-safe failures · FE runs before submit
  uploads/      start-upload.ts · allowed-content-type.ts · upload-size.ts · failures.ts
  videos/       metadata.ts · visibility-change.ts · failures.ts
  channels/     handle-format.ts · display-name.ts · failures.ts
  categories/   category-form.ts · slug-format.ts · failures.ts

packages/universal/domain-rules/src/        ← input + entity + policy · FE runs on cached entities
  uploads/      upload-open.rule.ts · part-manifest.rule.ts · size-match.rule.ts · failures.ts
  videos/       read-video.rule.ts · update-metadata.rule.ts · failures.ts
  channels/     claim-handle.rule.ts · subscribe.rule.ts · failures.ts
  categories/   create-category.rule.ts · delete-category.rule.ts · failures.ts
  reactions/    react.rule.ts · failures.ts
```

Either kind is a **pure function**: no `await`, no port, no `Date.now()` that is not passed in, no logging, no
`throw`. It returns `Result<T, SpecificFailureUnion>` and never decides how a failure is shown.

**Validation is parameterised, not hardcoded.** `validateStartUpload` takes the ceiling as an argument, because
the backend reads `MAX_UPLOAD_BYTES` from env and the frontend reads it from a config endpoint. The *rule* is
shared; the *limit* is a value each side supplies. That is what keeps the package universal — and it is why
`@vp/validation` can be T2 with no dependency on `@vp/config` or `@vp/domain`.

```ts
// packages/universal/validation/src/uploads/start-upload.ts   — both sides run THIS function
export function validateStartUpload(
  input: StartUploadInput,
  limits: UploadLimits
): Result<StartUploadInput, StartUploadFailure> { … }
// StartUploadFailure = UploadTooLarge | UnsupportedContentType | InvalidTitle
```

**`@vp/validation` never imports an entity type.** That is the machine-checked form of "input only", asserted
in W8: if a predicate needs a `Video` or an `UploadRecord`, it is a domain rule and belongs in the other
package.

#### What moves here

Everything currently inline in a route or a service that is a *decision* rather than a *call*:

- `apps/api/src/routes/uploads.ts:62` (size cap) and `:69` (`ALLOWED_CONTENT_TYPES`) — **`@vp/validation`**, and
  moving them also fixes the Rule 1 violation of having them in a route at all. `ALLOWED_CONTENT_TYPES` stops
  being a `Set` literal in a route file and becomes the rule's data, which `apps/web` can render as its
  dropzone `accept` map instead of hardcoding `video/mp4`.
- The checks in `upload-complete.ts` — split by what they read: the ones reading only the request go to
  **`@vp/validation`**, the ones reading the `UploadRecord` go to **`@vp/domain-rules`**.
- `assertAdminAccess`, the visibility branch in `video-service.ts`, the handle candidates in
  `channel-service.ts` — **`@vp/domain-rules`**.
- Handle format and display-name validation — **`@vp/validation`**, so the channel settings form can validate
  as you type.

**Prerequisite inside this workstream:** the rules operate on `@vp/domain` entity types, but the canonical
`Video` shape is hand-declared as `VideoRecord` in `packages/server/core/repositories/video-repository.ts` and
`@vp/domain` has no `video.ts` at all. Move the entity to `@vp/domain` and let `VideoRecord` alias it rather
than restate it. Same for `Upload`. `@vp/domain` already owns `category`, `channel`, `reaction`,
`subscription`, `public-feed` and `status-vocabulary`, so this closes the set.

---

### W4 — Ports and adapters return `Result`

The largest diff in the ticket, and the one that makes an infra failure visible in a signature instead of
invisible in a stack.

- Every method on the repository interfaces in `packages/server/core/repositories/` and the ports in
  `packages/server/core/ports/` that performs I/O returns `Promise<Result<T, InfraFailure>>`, where
  `InfraFailure` is the narrow union for that port (`DatabaseUnavailable` for repositories,
  `StorageUnavailable` for `StorageClient` / `MultipartStorage`, `CacheUnavailable` for `CacheClient`,
  `QueueUnavailable` for `JobQueue` / `FlowProducer`).
- **Absence is not a failure.** `findById` returns `Result<VideoRecord | null, DatabaseUnavailable>`. Whether a
  missing row is an error is a *domain* decision, and it belongs to the rule that asks.
- Every SDK call in `packages/server/adapters/**` is wrapped with `tryCatch` / `fromPromise` at the exact line
  the SDK is called. This is where the 178 `catch` blocks concentrate and then stop existing elsewhere.
- Constraint violations that the domain cares about are classified here, not swallowed: a unique-violation on
  `channels.handle` becomes `err(handleTaken(handle))`, which is what lets `channel-service.ts:191`'s
  `catch {}` be deleted rather than relocated.
- The in-memory doubles in `packages/server/adapters/in-memory/` return the same `Result` types. The contract
  conformance suite from ticket 82 W1 asserts both adapters agree on the failure, not only on the value.

---

### W5 — Services return `Result`, and contain no `throw`

Every service in `apps/api/src/services/` and every stage in `apps/worker/src/stages/`:

- returns `Promise<Result<T, E>>` where `E` is **inferred** from what it composes — the union of the rule
  failures it evaluates and the infra failures of the ports it calls. Never widened to `Error`, `unknown` or a
  hand-written `DomainFailure`.
- composes with `andThen` / `map` / `all`. A service that needs three ports and two rules reads as one chain.
- contains no `throw`, no `try`, no `catch`, no logging of a failure, and no HTTP vocabulary.
- may **narrow** a union deliberately — a service that handles `CacheUnavailable` internally by falling back to
  the repository drops it from its return type, which is the typed version of what `feed-service.ts:101` does
  today by swallowing. That is the one legitimate use of the swallow, and now it is visible in the signature.

`assertAdminAccess` and the `AuthorizationPort.assertCan` throw-path are replaced by `can`-returning rules;
`AuthorizationPort` keeps `can` and loses `assertCan`. Authorization stays exactly where Rule 3 of
`apps/api/AGENTS.md` puts it — inside the domain — it just returns its verdict instead of throwing it.

---

### W6 — The API edge: one seam, per-route overrides, and a narrowed global handler

**`sendResult(reply, request, result, options?)`** in `apps/api/src/routes/` is the only place in `apps/api`
where a `Result` is unwrapped.

```ts
sendResult(reply, request, result, {
  status: 201,                                              // success status, default 200
  on: { FORBIDDEN: (e) => problemFor(e, request.url, { status: 403, detail: e.message }) },
});
```

- `ok` → `options.status ?? 200` with the value as the body.
- `err` → `options.on?.[failure.code]` if the route overrides it, otherwise `problemFor(failure, request.url)`,
  which reads `PROBLEM_STATUS`. **The default is total**, so a route that wants the standard mapping writes
  nothing, and a route that wants to differ says so at the point that cares.
- `options.on` is typed `Partial<Record<E['code'], (failure: Extract<E, { code: C }>) => Problem>>`, so an
  override for a code the service cannot return is a compile error, and the handler receives the narrowed
  variant with its payload.

#### Two shapes, and when to use which

`on` is a **partial** override — convenient, but partial by definition, so it is not where exhaustiveness
bites. A route that wants to answer for the *whole* union writes a total presenter instead, and that is the
shape with the compile-time guarantee:

```ts
// apps/api/src/routes/uploads.presenter.ts   — total, exhaustive, and the only place a status is chosen
export function presentStartUpload(failure: StartUploadFailure, instance: string): Problem {
  switch (failure.code) {
    case 'UPLOAD_TOO_LARGE':
      return problemFor(failure, instance, { errors: [{ field: 'file', limit: failure.limitBytes }] });
    case 'UNSUPPORTED_CONTENT_TYPE':
      return problemFor(failure, instance, { errors: [{ field: 'file', allowed: failure.allowed }] });
    case 'UPLOAD_NOT_OPEN':
      return problemFor(failure, instance, { status: 410 });
    case 'DATABASE_UNAVAILABLE':
      return problemFor(failure, instance);           // 503, no payload on the wire
    default:
      return assertNever(failure, 'presentStartUpload');   // failure satisfies never
  }
}
```

Add a failure to the rule and this file **stops compiling** until someone decides what it looks like over HTTP.
That is the property, and it is why the presenter is a named module with its own test rather than an inline
lambda.

| Use | When |
|---|---|
| nothing — the `PROBLEM_STATUS` default | the standard mapping is right. Most routes. |
| `options.on` | one code, one route, differs from the default (the public-vs-admin `FORBIDDEN` case). |
| a total presenter module + `assertNever` | the route owns a real mapping — several codes, field-scoped bodies, or a union that will grow. Forms and writes. |

**The presenter is not a domain service.** It is a transport module that lives next to its route, imports no
port and holds no rule. If a "presenter" starts calling a repository, it is a service and belongs in
`services/`; if it starts branching on a business condition, that branch is a rule and belongs in
`@vp/domain-rules`. Routes stay thin either way: validate, extract identity, call the service, hand the
`Result` to `sendResult`.

**On the "global middleware" question — the answer is both, with a clear split.** `setErrorHandler` stays and
is *narrowed to a backstop*:

| Reaches the global handler | Reaches `sendResult` |
|---|---|
| Fastify/Zod transport validation failures | every domain failure |
| rate limiting (`FST_ERR_RATE_LIMIT`) | |
| auth plugin rejections (`plugins/auth.ts`, `jwks-verifier.ts` — a pre-handler has no `Result` to return) | |
| a genuine invariant violation (`assertNever`, a bug) → 500 + `request.log.error` | |

A global handler *cannot* be the primary seam for domain failures, and it is worth writing down why: it
receives `unknown`, so it cannot be exhaustive, and it is one function for the whole app, so it cannot let two
routes render the same failure differently — which is the requirement this ticket exists to satisfy. Both paths
call the same `problemFor`, so the body is byte-identical either way.

Routes stay thin (SDD §6.4): validate, extract identity, call the service, `sendResult`. No rule, no repository,
no `if (!x) return reply.status(404)`.

---

### W7 — The worker edge: `Result` → the retry taxonomy

BullMQ's retry contract *is* the exception — a stage that returns normally is a completed job. So the worker
edge converts, and it is the only place in `apps/worker` that throws:

```ts
// apps/worker/src/runner.ts
const outcome = await stage(job);
if (isErr(outcome)) throw toQueueError(outcome.error);   // RETRY_CLASS → Permanent | Transient
```

`toQueueError` reads `RETRY_CLASS` (W2), so ADR-18's "decided at the throw site, never by regex on messages"
becomes "decided once per code, in the vocabulary, and the throw site has no judgement left to make". The
unknown-error default (transient, attempt cap 3) still applies to anything that escapes as a raw throw.
Dual-runtime parity is unaffected: `@vp/result` is plain TypeScript with no `Bun.*` and no `node:*`.

---

### W8 — Machine enforcement, docs and standards

Following ticket 82's rule: **an invariant that cannot be asserted is deleted from the docs rather than left as
decoration.**

| New assertion | Holds | Fixture that proves it fires |
|---|---|---|
| `tests/architecture/no-domain-throw.test.ts` | no `throw` in `packages/universal/validation/**`, `packages/universal/domain-rules/**`, `packages/server/core/**`, `apps/api/src/services/**`, `apps/worker/src/stages/**` except a call to `assertNever` | a `throw new Error` added to a rule |
| `tests/architecture/validation-is-input-only.test.ts` | `@vp/validation` imports no entity type and no `@vp/domain`/`@vp/core` module, from source **and** from its manifest | a predicate taking a `VideoRecord` added to `@vp/validation` |
| `tests/architecture/catch-confinement.test.ts` | `catch` appears only in `@vp/result`, `packages/server/adapters/**`, the two composition roots and the two edges (`plugins/errors.ts`, `runner.ts`) | a `try/catch` added to a service |
| `tests/architecture/result-returning-ports.test.ts` | every I/O method on a `@vp/core` port or repository interface returns `Promise<Result<…>>` | a port method returning a bare `Promise<T>` |
| `tests/architecture/error-code-drift.test.ts` | every `ErrorCode` appears in SDD §6.2, `PROBLEM_STATUS` and `RETRY_CLASS` | a code added to `ApiErrorCodes` only |

`catch-confinement.test.ts` ships with a **shrink-only** allowlist at
`tests/architecture/legacy-catch-sites.ts`, exactly like `oversized-sources.ts` and `untested-sources.ts`: it
fails on a new breach **and** on a listed entry that no longer breaches, so the list can only get shorter and
may not be appended to. W4 and W5 empty most of it; whatever remains is named with a reason.

Documentation — all of it in the same PRs, not a follow-up:

- **`docs/standards/error-handling.md`** (new) — the authority. The three layers, the `Result` API, the
  `Failure` discriminant, where a rule goes vs. where a service goes, the two edges, the `assertNever`
  contract, and worked before/after diffs from `video-service.ts` and `channel-service.ts`.
- **`docs/SDD.md`** — **new ADR-24 "Result-typed error handling: domain returns, the edge decides"** with the
  rejected alternatives (`neverthrow`, exceptions + a global handler only, Go-style tuples) and why; ADR-18
  updated to point at `RETRY_CLASS`; §6.2 gains the four new codes; §6.4 updated so routes `sendResult`;
  §15.1 gains `@vp/result`, `@vp/validation` and `@vp/domain-rules`.
- **`ARCHITECTURE.md`** — new **Invariant 7: Results at the domain seam**; §6 table gains the four assertions.
- **`AGENTS.md` (root)** — new Core Non-Negotiable Rule 14; the directory index gains the two packages.
- **`packages/AGENTS.md`** — the layer tables gain `@vp/result` (T1), `@vp/validation` (T2) and
  `@vp/domain-rules` (T3); the *"I need a server package from the frontend"* recipe now names them as the
  answer for rules, with the input-vs-entity test spelled out.
- **New `AGENTS.md` + `CLAUDE.md` symlink** in `packages/universal/result/`,
  `packages/universal/validation/` and `packages/universal/domain-rules/` (`pnpm sync:claude`, verified by
  `pnpm boundaries`). Each states the one-sentence test for what belongs in it: *validation needs only the
  input; a domain rule needs an entity.*
- **Updated `AGENTS.md`** in `packages/universal/errors/` (its Invariant 1 currently mandates inheriting from
  `PermanentError`/`TransientError` — that becomes the queue-boundary rule, not the domain rule),
  `packages/server/core/`, `packages/server/adapters/`, `apps/api/` (Rule 4 rewritten, and Rule 1 extended to
  say validation belongs in `@vp/validation`, not in a route), `apps/worker/` and **`apps/web/`** (where
  validation comes from and what a component may not hold — documentation only, no code).
- **Ticket updates** — 42, 43, 44, 45, 46, 47, 48, 50, 51, 53, 70 and 83 carry a note that their services
  return `Result`, their input checks belong in `@vp/validation` and their entity-dependent decisions in
  `@vp/domain-rules`, and their new packages/codes must land in both exhaustive maps. Ticket 70's scope shrinks: the frontend taxonomy it was going to derive from the wire
  format is now an import.

---

### W9 — The frontend consumption contract — documented, **not implemented**

**No `apps/web` code changes in this ticket** — verified by the PR diff. What lands is the written contract, in
`docs/standards/error-handling.md`, `apps/web/AGENTS.md` and both new packages' `AGENTS.md`, so tickets
53/70/71 implement against a decision instead of making one. W3 is what makes the contract *implementable*:
`@vp/validation` exists, is universal, and is already the backend's authority.

#### The flow, end to end, with one rule

```
user types / drops a file
  └─ validateStartUpload(input, limits)          ← @vp/validation, runs in the browser
       ├─ err → toast / field error, NO network call        ← optimistic, ~5 ms
       └─ ok  → POST /v1/uploads                            ← happy path leaves the hook
                  └─ apps/api runs validateStartUpload(input, limits)  ← THE SAME FUNCTION, the authority
                       ├─ err → presentStartUpload(failure) → Problem   ← W6
                       └─ ok  → UploadService.initiate(...)
```

The browser copy is a **latency and UX optimisation, never the authority** — a client can always be bypassed,
so the backend re-runs it unconditionally. The point is that "re-runs it" means the identical function, not a
second implementation that drifts, which is exactly what `upload-video-form.tsx:23` vs `routes/uploads.ts:21`
is today.

Because both sides produce the *same failure union*, and W2 makes input-rule payloads wire-safe, the hook maps
a locally-computed failure and a server-returned one through **one** `switch`.

#### The component holds no logic

State, rule evaluation, submission and the failure-to-presentation mapping all live outside the component. A
component receives a view state and renders it; it does not decide anything.

```ts
// useStartUpload.ts — owns BOTH branches. Nothing below is allowed in the component.
export function useStartUpload() {
  const limits = useUploadLimits();
  const [state, setState] = useState<ViewState<StartedUpload, StartUploadFailure>>({ status: 'idle' });

  const submit = async (input: StartUploadInput) => {
    const validated = validateStartUpload(input, limits);       // the shared rule
    if (isErr(validated)) return setState(present(validated.error));   // no network call

    setState({ status: 'loading' });
    const sent = await uploadsClient.start(validated.value);    // @vp/api-client
    setState(isOk(sent) ? { status: 'success', data: sent.value } : present(sent.error));
  };

  return { ...state, submit };
}
```

- **`ViewState`** is the shape every hook returns:
  `{ status: 'idle' | 'loading' | 'success' | 'error'; data?: T; failure?: E; fieldErrors?: Record<string, string> }`.
- **`present(failure)`** is the frontend's total `switch` with `assertNever` in the `default` — the mirror of
  the backend presenter in W6, and the reason a new failure variant breaks the frontend build too.
- **The component is `({ status, data, failure, submit }) => JSX`.** No `useEffect` calling an API, no
  `try/catch`, no `if (error.code === …)`, no validation literal. If a component needs a rule, it needs a hook.

#### Success is extracted too, not just failure

The happy path is as much logic as the error path and leaves the component the same way: the hook decides what
"success" means — navigate, invalidate a query, reset the form, fire the next request in a sequence. A
component that renders `status === 'success'` differently from another component is the *only* difference
between them.

#### Two consumers, one rule, different handling

The guarantee W6 gives two routes, given to two components:

| Consumer | Same `validateStartUpload` | `UNSUPPORTED_CONTENT_TYPE` becomes |
|---|---|---|
| upload page | ✓ | an inline field error under the dropzone, form stays open |
| creator-studio bulk import | ✓ | a toast, that row marked failed, the queue continues |

Neither touches the rule. That is the reason the rule returns a `Result` instead of rendering, throwing or
logging — stated here so the next reader does not "simplify" it by moving a message into the rule.

#### Named now so it is not invented twice

- **`@vp/api-client` (tier `client`)** gets `toViewState(result)` and returns `Result` from its fetchers —
  ticket 51 builds it, this ticket fixes the shape.
- **The limits endpoint.** Validation is parameterised (W3), so the frontend needs `MAX_UPLOAD_BYTES` and the
  allowed content types as *data*. Whether that is a field on an existing response or a small `GET /v1/config`
  is ticket 53's call; what is decided here is that the limit is **supplied to** the rule, never baked into it.
- **The form layer depends on `@vp/validation` only.** That is what makes it impossible for a form to reach a
  rule needing a fetch, and it is the reason the packages are split rather than foldered.

---

## Acceptance criteria

### W1 — `@vp/result`
- [ ] `packages/universal/result` exists, tier `universal` (by directory), `"vp": { "layer": 1 }`, **zero**
      runtime dependencies, and `pnpm boundaries` passes.
- [ ] `Result<T, E>` is the stated discriminated union; `ok`/`err`/`isOk`/`isErr` narrow correctly, asserted
      with type-level tests as well as runtime ones.
- [ ] `map`, `mapErr`, `andThen`, `unwrapOr`, `match`, `all`, `andThenAsync`, `mapAsync` implemented and tested.
- [ ] `tryCatch`, `fromThrowable`, `fromPromise` convert a throwing call into a `Result` and are tested against
      a throw, a rejection and a non-`Error` throw value.
- [ ] Async functions return `Promise<Result<T, E>>`; there is **no `ResultAsync` class** anywhere.
- [ ] `assertNever` exists; a test fixture proves that adding a variant to a union makes an existing exhaustive
      `switch` **fail to compile** (a `tsc --noEmit` expect-error fixture, not a runtime assertion).
- [ ] Every source file has its 1:1 `__tests__/<name>.test.ts`; green under `vitest` **and** `bun test`;
      no file over 250 lines.

### W2 — Failure vocabulary
- [ ] `Failure<C extends ErrorCode, D>` exists in `@vp/errors`; every failure type in the repo is built from it
      and discriminates on `code`. No failure type is `Error`, `string` or `unknown`.
- [ ] `RETRY_CLASS` is a `Readonly<Record<ErrorCode, 'permanent' | 'transient'>>`; omitting a code is a compile
      error, proven by a fixture.
- [ ] `DATABASE_UNAVAILABLE`, `CACHE_UNAVAILABLE`, `QUEUE_UNAVAILABLE` and `INVALID_CURSOR` exist in
      `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and SDD §6.2.
- [ ] `problemFor(failure, instance, overrides?)` in `@vp/api-contracts` is the single `Problem` renderer;
      `plugins/errors.ts` and `sendResult` both call it and a test asserts identical bodies.
- [ ] `@vp/validation` failure payloads are projected into `Problem.errors`; `@vp/domain-rules` and infra
      payloads are **not** on the wire, and `problemFor` distinguishes them by type rather than by a list. A
      test asserts `DatabaseUnavailable`'s `operation` never appears in a response body and `UploadTooLarge`'s
      limit does; an expect-error fixture proves passing a domain-rule failure to the payload-projecting
      overload does not compile.
- [ ] `@vp/errors` remains T1 universal with no new dependency; `pnpm why bullmq` from `apps/web` still returns
      nothing.

### W3 — `@vp/validation` and `@vp/domain-rules`
- [ ] `packages/universal/validation` exists, tier `universal`, `"vp": { "layer": 2 }`, depending **only** on
      `@vp/result` and `@vp/errors`; `packages/universal/domain-rules` exists, tier `universal`,
      `"vp": { "layer": 3 }`, depending on `@vp/validation`, `@vp/permissions` and `@vp/domain`.
      `pnpm boundaries` passes with no exception entry, and `lockfile-closure.test.ts` still reports zero
      `server`-tier packages reachable from `apps/web`.
- [ ] **`@vp/validation` imports no entity type** — no `@vp/domain`, no `@vp/core`, no record shape. Asserted by
      W8 and proven by a violating fixture; this is the machine-checked form of "input only".
- [ ] One rule per file in both packages, with a `failures.ts` per resource exporting its variants and unions.
- [ ] Every rule in both packages is pure: no `await`, no port, no `Date.now()`, no logging, no `throw` —
      asserted by W8.
- [ ] **Both packages run with no ports, no network and no server globals.** Each has a vitest config running
      its suites under `environment: 'jsdom'` as well as node, so a browser-hostile API fails a test rather
      than a review.
- [ ] Validation takes its limits as **arguments** (`validateStartUpload(input, limits)`); no rule in either
      package reads `MAX_UPLOAD_BYTES`, an env var, a config module or a hardcoded ceiling.
- [ ] `ALLOWED_CONTENT_TYPES` and the size cap live in `@vp/validation`, not in `apps/api/src/routes/uploads.ts`;
      the route performs no validation of its own, closing that Rule 1 violation.
- [ ] A fixture proves the client tier can consume both: a file under a `client`-tier compilation unit imports
      and calls `validateStartUpload` **and** a domain rule against a plain entity object, and `pnpm boundaries`
      plus `lockfile-closure.test.ts` pass.
- [ ] The `Video` and `Upload` entities live in `@vp/domain`; `VideoRecord`/`UploadRecord` in `@vp/core` alias
      them rather than restating their fields.
- [ ] `assertAdminAccess`, the upload size/content-type/expiry checks, the handle-format and handle-candidate
      logic and the video visibility branch exist **only** here — a grep for each in `apps/api` returns nothing.
- [ ] Typecheck proves the tier: a `node:*` import added to any file in this package is `error TS2307`.

### W4 — Ports & adapters
- [ ] Every I/O method on `@vp/core` ports and repository interfaces returns `Promise<Result<T, InfraFailure>>`
      with the narrow union for that port. Asserted by `result-returning-ports.test.ts`.
- [ ] Absence returns `ok(null)`, not a failure — `findById`, `findByHandle`, `findWithDetails` and siblings.
- [ ] Every SDK call in `packages/server/adapters/**` is wrapped at the call site; no `catch` remains in an
      adapter that is not a `tryCatch`/`fromPromise` boundary.
- [ ] Unique-violation on `channels.handle` surfaces as `HANDLE_ALREADY_TAKEN`, not a swallowed exception.
- [ ] The in-memory doubles return the same `Result` types; the ticket-82 contract conformance suite asserts
      both adapters agree on **failures** as well as values, including the handle conflict.

### W5 — Services
- [ ] Every service in `apps/api/src/services/` and every stage in `apps/worker/src/stages/` returns a
      `Result`; **zero** `throw`, `try` or `catch` in either tree — asserted by W8.
- [ ] Error unions are inferred from composition. A test fixture adds a failure to a rule and proves the
      service's inferred return type widens and the route stops compiling.
- [ ] `VideoService.get` returns `VideoNotFound` and `VideoForbidden` as **distinct** variants; nothing in the
      service converts one into the other.
- [ ] `channel-service.ts`'s two `catch {}` blocks are gone, replaced by typed conflict handling; a test proves
      a concurrent duplicate identity still succeeds **and** that a dead database now surfaces instead of
      producing a channel-less user.
- [ ] `feed-service.ts`'s cache fallback is a deliberate narrowing: `CacheUnavailable` is absent from its return
      type because it is handled, and a test asserts the feed still serves when the cache is down.
- [ ] `AuthorizationPort.assertCan` is deleted; `can` remains; no service throws an authorization failure.
- [ ] No service file exceeds 400 lines / 10 KB; every one has its 1:1 test file.

### W6 — API edge
- [ ] `sendResult` exists and is the **only** unwrap point in `apps/api/src/routes/**` — asserted by W8.
- [ ] Its default mapping is total over `ErrorCode` via `PROBLEM_STATUS`; a route needing the standard response
      passes no options.
- [ ] `options.on` is typed from the service's own error union: an override for an unreachable code is a compile
      error, and the handler receives the narrowed variant with its payload. Proven by an expect-error fixture.
- [ ] At least one route ships a **total presenter module** (`*.presenter.ts`) with a `switch` over its full
      failure union and `assertNever(failure)` in the `default`; an expect-error fixture proves that adding a
      variant to the rule breaks its compilation. `docs/standards/error-handling.md` records when to use the
      default, `on`, or a presenter.
- [ ] A presenter imports no port and holds no business branch — asserted by W8's `no-domain-throw` sweep
      extended to flag a repository import under `routes/`.
- [ ] **The two-consumer demonstration ships as a test:** the public video route renders `VideoForbidden` as a
      generic `404`, an admin route renders the same failure from the same service call as a detailed `403`,
      and `VideoService` contains no branch for either.
- [ ] `setErrorHandler` is narrowed to the backstop table above; a test asserts that a domain failure reaching
      it is a **bug**, and that the backstop and `sendResult` produce identical bodies for the same failure.
- [ ] Every route is transport-only; the contract-drift test from ticket 82 still passes.

### W7 — Worker edge
- [ ] `runner.ts` is the only `throw` in `apps/worker`; it converts via `RETRY_CLASS`.
- [ ] A permanent failure goes straight to the DLQ with no retry; a transient one retries with backoff — both
      asserted against the real queue behaviour, not the mapping table.
- [ ] Raw throws escaping a stage still default to transient with the attempt cap of 3 (ADR-18 unchanged).
- [ ] `pnpm test:bun` green for `apps/worker` and every package it imports.

### W8 — Enforcement & docs
- [ ] The four assertions in the table exist in `tests/architecture/`, run in `pnpm test:architecture` and in
      CI's `lint-typecheck` fail-fast step, and each is proven by a deliberately-violating fixture.
- [ ] `tests/architecture/legacy-catch-sites.ts` is shrink-only and fails both on a new breach and on a stale
      entry; its remaining entries each carry a one-line reason.
- [ ] `docs/standards/error-handling.md` exists with the layer table, the API, and the before/after diffs.
- [ ] SDD: **ADR-24** added with rejected alternatives; ADR-18 points at `RETRY_CLASS`; §6.2 lists the new
      codes; §6.4 describes `sendResult`; §15.1 lists both new packages.
- [ ] `ARCHITECTURE.md`: Invariant 7 added; §6 table gains the four rows.
- [ ] Root `AGENTS.md`: Rule 14 added; directory index updated. `packages/AGENTS.md`: the layer tables updated
      and the frontend recipe names `@vp/validation` and `@vp/domain-rules` with the input-vs-entity test.
- [ ] `AGENTS.md` written for all three new packages and updated for `errors`, `core`, `adapters`, `api`,
      `worker`, `web`; every one has its `CLAUDE.md` symlink and `pnpm boundaries` passes.
- [ ] Tickets 42, 43, 44, 45, 46, 47, 48, 50, 51, 53, 70 and 83 carry the note; ticket 70's scope is reduced in
      writing. `python3 docs/tickets/gen-index.py` re-run.

### W9 — Frontend contract (documentation only)
- [ ] `docs/standards/error-handling.md` documents the end-to-end flow diagram, the `ViewState` shape, the
      `present(failure)` total-`switch` mirror of the backend presenter, and when consumption is inline vs.
      extracted — with the `validateStartUpload` walkthrough as the worked example.
- [ ] It states that **the component holds no logic**: no API call, no `try/catch`, no `if (failure.code === …)`,
      no validation literal, no success-path decision. A hook or presenter owns **both** branches and the
      component is `(viewState) => JSX`.
- [ ] It states that the browser copy of an input rule is an optimisation and the backend re-runs it as the
      authority — and that "re-runs it" means the identical imported function.
- [ ] The two-consumers-one-rule table is documented (upload page: inline field error · bulk import: toast and
      continue), with the explicit note that neither touches the rule.
- [ ] `apps/web/AGENTS.md` gains a section: `@vp/validation` is where form checks come from and
      `@vp/domain-rules` is where entity-dependent decisions come from, hooks unwrap `Result`, components do
      not; the hardcoded `{ 'video/mp4': ['.mp4'] }` at `upload-video-form.tsx:23` is named as the thing
      ticket 53 deletes.
- [ ] Both packages' `AGENTS.md` state that `apps/web` is a first-class consumer, that validation must stay
      browser-runnable and parameterised, that a domain rule runs against a cached entity in the browser as
      readily as against a repository read on the server, and that neither may render, log or format.
- [ ] The limits-as-data decision is recorded: the rule receives the ceiling and the allowed types, and how the
      frontend obtains them is ticket 53's call.
- [ ] **Zero changes under `apps/web/`** in this ticket — verified by the PR diff.

### Repo-wide
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`,
      `pnpm build`, `make smoke-offline` and `make e2e` all green, with output pasted in the PR.
- [ ] No new runtime dependency anywhere (local-first, PRD G11 / SDD P9).

---

## Out of scope

- **Any `apps/web` implementation.** W9 is a written contract; tickets 53, 70 and 71 build against it.
- **Changing the wire format.** RFC 9457 Problem Details stays exactly as it is; a client cannot tell that the
  server stopped throwing. The four new codes are additive.
- **Removing `PermanentError` / `TransientError`.** They remain the BullMQ boundary representation.
- **Retrofitting `@vp/ffmpeg`, `@vp/observability`, `@vp/dev-token`, `@vp/gen-video`, `@vp/upload-client`.**
  Process spawning and CLI tools keep throwing; their call sites are wrapped at the adapter/stage boundary.
- **A `Result`-returning `@vp/api-client`.** Ticket 51 owns the client; W9 records the decision.

## Notes for the implementer

- **Land W1–W3 first and merge them.** They add packages and change no caller, so they can be reviewed on their
  own merits. W4 is where the diff gets large and rebasing gets expensive — do not have it open alongside W5.
- **Convert one resource end-to-end before fanning out.** Categories is the smallest complete slice
  (validation → domain rule → repository → service → route, plus an admin consumer) and becomes the reference
  every other resource copies. Do not convert six resources halfway.
- **When a predicate is hard to place, follow its parameters.** If it compiles without importing an entity
  type, it is validation. If it needs a `Video`, an `UploadRecord` or a `UserContext`, it is a domain rule.
  There is no third answer, and the W8 assertion will tell you when you got it wrong.
- **Resist a second error vocabulary.** If a failure needs a code that `ErrorCodes` does not have, add it to
  `ErrorCodes` and to both exhaustive maps. A failure type whose `code` is a bare string is a review rejection.
- **The unions must be inferred.** If you find yourself writing `Promise<Result<T, DomainFailure>>`, the
  composition is wrong — a widened union is the same information loss as `throw`, one indirection later.
- **`tryCatch` at the exact line the SDK is called**, not around a block. A wrapper around ten statements
  cannot say which one failed, which is the property that made `catch {}` unreviewable in the first place.
- **Read the whole file you touch.** These are large mechanical diffs across files that already carry
  needless projections and near-duplicate tests; fold sibling tests into `it.each` and inline single-use
  wrappers in the same change rather than leaving them for the next reader.

## Testing plan

- **Type-level tests** — `tsc --noEmit` expect-error fixtures for the three compile-time guarantees: an
  unhandled variant in a `switch`, an override for an unreachable code in `sendResult.on`, and a missing entry
  in `RETRY_CLASS`. A guarantee that is only asserted at runtime is not the guarantee this ticket promises.
- **Unit** — 1:1 per source file (Rule 12). Rules are trivially testable: pure in, `Result` out, no doubles.
- **Contract** — the ticket-82 conformance factories extended to failures, run against both the in-memory and
  the PGLite-backed adapters.
- **Route** — the two-consumer test (same service call, different status) and a backstop-equivalence test.
- **Worker** — a permanent failure reaching the DLQ without retry, a transient one retrying, under Node **and**
  Bun.
- **Architecture** — the four new assertions plus their violating fixtures.
- **Acceptance** — `make e2e` and `make smoke-offline` unchanged and green; the external behaviour of the API
  is identical apart from the four new codes.

## Open questions

- **Do repository reads return `Result` at all, or only writes?** *Decided:* all I/O, reads included. A read is
  exactly where a dead database is invisible today, and a mixed convention is worse than either pure one.
- **Does `@vp/domain-rules` depend on `@vp/permissions`, or do rules take a pre-computed verdict?** *Decided:*
  it depends on it — a visibility rule that cannot read the policy is not a rule, it is a parameter. That makes
  it **T3**, since `@vp/permissions` and `@vp/validation` are both T2 and a sibling edge is forbidden. Confirm
  against `scripts/check-boundaries.ts` in W3 and record both layers in the `packages/AGENTS.md` map.
- **One rule package with `input/` and `state/` folders, or two packages?** *Decided:* two. The split decides
  callability (before a network call vs. after a read), wire safety (W2 projects one payload and not the
  other), and what a consumer can reach (the form layer gets `@vp/validation` alone). As folders all three are
  conventions; as packages the compiler and `pnpm boundaries` enforce them, which is ticket 82's whole lesson.
  The cost is one extra manifest, tsconfig and `AGENTS.md`.
- **Does the `Failure` payload reach the client?** *Decided:* it depends on the rule kind, and that is the
  point of the split. An **input-rule** failure contains only what the client sent, so it is wire-safe by
  construction and `problemFor` projects it into `Problem.errors` — which is what lets a form highlight the
  offending field after a server rejection. A **state-rule** or **infra** failure sends `code`/`title`/
  `status`/`detail` only. No per-field allowlist to maintain, and no judgement call at each call site.
- **Do the frontend and the backend share the *presenter*, or only the rule?** *Decided:* only the rule. A
  `Problem` and a toast are different answers to the same failure, and a shared presenter would force one of
  them to win — which is the coupling this ticket exists to remove. `present()` and `presentStartUpload()` are
  deliberate near-duplicates over the same `switch`; the exhaustiveness check keeps them in step, not a shared
  implementation.

## Definition of Done

Every AC above ticked with pasted evidence; all nine workstreams merged; `**Status:**` set to `done` and
`python3 docs/tickets/gen-index.py` re-run; branch-protected squash merges per
[docs/standards/git-workflow.md](../standards/git-workflow.md).
