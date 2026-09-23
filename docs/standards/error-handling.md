# Error handling: domain code returns, the edge decides

The authority for how a failure travels through this repo. Spec: [SDD ADR-24](../SDD.md#adr-24-result-typed-error-handling-domain-returns-the-edge-decides) ·
[ADR-18](../SDD.md#adr-18-error-taxonomy-decides-retry-policy) · [§6.2](../SDD.md#62-error-codes-stable-machine-readable) · [§6.4](../SDD.md#64-api-layer-architecture-thin-transport-routes-domain-services).

## The problem this replaces

`VideoService.get(user, id)` used to type as `Promise<VideoDetailView>`. It could fail three ways
and the compiler knew about none of them, so adding a fourth was a non-breaking change that no
caller handled. Worse, it threw `VIDEO_NOT_FOUND` both because the row was absent and because CASL
said no - a service three layers below HTTP had decided that a private video should look like a
missing one, and no second consumer could choose differently because the distinction was destroyed
at the throw site.

## The four layers

| Layer | Lives in | Tier · layer | Needs | Returns |
|---|---|---|---|---|
| **1a. Validation** | `@vp/validation` | `universal` · T2 | the input, nothing else | `Result<T, InputFailure union>` |
| **1b. Domain rules** | `@vp/domain-rules` | `universal` · T3 | input **+** an entity **+** policy | `Result<T, Failure union>` |
| **2. Services** | `apps/api/src/services/`, `apps/worker/src/stages/` | `server` | ports and rules | `Result<T, rule + infra failures>` |
| **3. Edge** | `apps/api/src/routes/`, `apps/worker/src/composition/stages.module.ts`, later `apps/web` | `server` / `client` | HTTP, BullMQ, the DOM | a response, a throw at the queue boundary, a view state |

Layers 1 and 2 never log a failure, never format one and never `throw`. Layer 3 never contains a
rule. All four are asserted in `tests/architecture/`, not just written here.

## Where a predicate goes

**Follow its parameters.** If it compiles without importing an entity type, it is validation. If it
needs a `Video`, an `Upload` or a `UserContext`, it is a domain rule. There is no third answer, and
`validation-is-input-only.test.ts` tells you when you got it wrong.

That split decides three things a folder could not enforce:

1. **Callability.** Validation runs before any network call, so a form gives feedback as you type. A
   domain rule needs an entity, so it runs after a read.
2. **Wire safety.** An input failure can only contain what the client already sent, so `problemFor`
   projects its payload into `Problem.errors`. A domain-rule or infra failure may carry ids and
   internal state, so only `code`, `title`, `status` and `detail` cross.
3. **What a consumer can reach.** The frontend's form layer depends on `@vp/validation` alone and
   therefore cannot import a rule that needs a fetch.

## The API

`@vp/result` is mechanism. It knows nothing about `ErrorCode`, HTTP or this domain.

```ts
type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
```

- **Constructors:** `ok(value)`, `ok()` for a void success, `err(error)`.
- **Guards:** `isOk`, `isErr` - real type predicates that narrow.
- **Combinators:** `map`, `mapErr`, `andThen`, `unwrapOr`, `all`, `match`.
- **Async:** `mapAsync`, `andThenAsync`. There is no `ResultAsync` class; every async function
  returns `Promise<Result<T, E>>` so a plain `await` is always legal.
- **Boundary:** `tryCatch`, `fromPromise`, `fromThrowable` - the only sanctioned `catch` outside an
  adapter.
- **Exhaustiveness:** `assertNever(value, context)` in the `default:` of any switch over a failure
  union.

## The failure type

The discriminant is `code`, whose type is a literal member of the existing `ErrorCode`. **No second
error vocabulary.** A failure whose `code` is a bare string is a review rejection; if a rule needs a
code `ErrorCodes` does not have, add it to `ErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and SDD §6.2
or do not add it at all.

```ts
export type Failure<C extends ErrorCode, D extends object = Record<never, never>> =
  Readonly<{ code: C; message: string } & D>;

export type InputFailure<C extends ErrorCode, D extends object = Record<never, never>> =
  Readonly<{ code: C; message: string; field: string } & D>;
```

An input failure names the field it rejected. Nothing that reads an entity or an adapter can, which
is why `problemFor` reads wire safety off the type instead of consulting a per-field allowlist.

`VALIDATION_FAILED` is deliberately one code shared by every field rule that has no code of its own.
Build one with `invalidField` / `invalidLength`. A union of two `VALIDATION_FAILED` variants still
switches exhaustively, and the consumer reads `field` - which is exactly what `Problem.errors`
carries.

## Before and after

**`video-service.ts` - absent and forbidden were the same answer:**

```ts
// before: two different reasons, one code, decided three layers below HTTP
const details = await this.videos.findWithDetails(videoId);
if (!details) throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
if (!this.auth.can(canReadVideo, { user, video })) {
  throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
}

// after: the rule keeps them distinct and the route decides what each looks like
export function decideVideoRead(input: ReadVideoInput): Result<Video, ReadVideoFailure> {
  if (!input.video) return err(videoNotFound(input.videoId));
  if (!canReadVideo({ user: input.viewer, video: input.video })) {
    return err(videoForbidden(input.videoId));
  }
  return ok(input.video);
}
```

**`channel-service.ts` - `catch {}` could not tell intent from fault:**

```ts
// before: a unique violation and a dead Postgres are indistinguishable, and the second
// one silently produces a channel-less user
try {
  await this.channels.create({ userId, handle, displayName });
} catch {
  // A concurrent request for the same identity already created the channel.
}

// after: the adapter classifies what the constraint reported, and the service answers it
const created = await this.channels.create({ userId, handle, displayName });
if (isErr(created) && created.error.code !== ErrorCodes.HANDLE_ALREADY_TAKEN) return created;
```

## The API edge

`sendResult(reply, request, result, options?)` is the only place in `apps/api` where a `Result` is
unwrapped. Three shapes, and when to use which:

| Use | When |
|---|---|
| nothing - the `PROBLEM_STATUS` default | the standard mapping is right. Most routes. |
| `options.on` | one code, one route, differs from the default (the public-vs-admin `FORBIDDEN` case). |
| a total presenter module + `assertNever` | the route owns a real mapping - several codes, field-scoped bodies, or a union that will grow. Forms and writes. |

`options.on` is typed from the service's own error union, so an override for a code the service
cannot return is a compile error and the handler receives the narrowed variant with its payload. It
is **partial** by definition, so it is not where exhaustiveness bites. A route that wants to answer
for the whole union writes a total presenter next to itself:

```ts
// apps/api/src/routes/admin/categories.presenter.ts
switch (failure.code) {
  case 'CATEGORY_SLUG_CONFLICT':
    return problemFor(failure, instance, { errors: [{ field: 'slug', slug: failure.slug }] });
  case 'CATEGORY_IN_USE':
    return problemFor(failure, instance, {
      detail: `Reassign or delete the ${failure.videoCount} video(s) using this category first`,
    });
  ...
  default:
    return assertNever(failure, 'presentAdminCategoryFailure');
}
```

Add a failure to the rule and that file stops compiling until someone decides what it looks like
over HTTP. That is the property, and it is why a presenter is a named module with its own test
rather than an inline lambda. **A presenter is not a domain service**: it imports no port and holds
no rule. If it starts calling a repository it is a service; if it starts branching on a business
condition, that branch is a rule.

`videos.presenter.ts` is the worked example of that last sentence. The public route hides a video
the caller may not read behind a 404, because a 403 would confirm the id exists. But a refusal to
*edit* a video they can already see hides nothing and stays a 403 - and telling those two apart is a
business condition, so it is not the presenter's to make. `VideoForbidden` carries `readable`, the
rule sets it, and `publicReadFailure` in `@vp/domain-rules` owns the disguise for the public route,
the PATCH route and the SSE stream alike. The presenter calls it and decides nothing.

`UNAUTHORIZED` survives the disguise, because a caller with no token can act on a 401 and can do
nothing with a 404.

### The global handler stays, narrowed to a backstop

| Reaches the global handler | Reaches `sendResult` |
|---|---|
| Fastify/Zod transport validation failures | every domain failure |
| rate limiting (`FST_ERR_RATE_LIMIT`) | |
| auth plugin rejections - a pre-handler has no `Result` to return | |
| a genuine invariant violation (`assertNever`, a bug) -> 500 + `request.log.error` | |

A global handler cannot be the primary seam for domain failures, and it is worth writing down why:
it receives `unknown`, so it cannot be exhaustive, and it is one function for the whole app, so it
cannot let two routes render the same failure differently - which is the requirement this design
exists to satisfy. Both paths call the same `problemFor`, so the body is byte-identical either way.

## The worker edge

BullMQ's retry contract *is* the exception: a stage that returns normally is a completed job. So the
runner converts, and it is the only place in `apps/worker` that throws.

```ts
const outcome = await stage(job);
if (isErr(outcome)) throw toPipelineError(outcome.error); // RETRY_CLASS -> Permanent | Transient
```

`toPipelineError` reads `RETRY_CLASS`, so ADR-18's "decided at the throw site, never by regex on
messages" becomes "decided once per code, in the vocabulary, and the throw site has no judgement
left to make". The unknown-error default - transient, attempt cap 3 - still applies to anything that
escapes as a raw throw.

A stage returns its outcome, so the runner hands BullMQ `outcome.value` rather than the `Result`
itself: a parent flow job reads its children's return values, and the wrapper stops at this seam.

### Classifying something that is already an exception

`classifyError(error)` in `@vp/errors` is the one place that answers "is this permanent". It returns
`'permanent' | 'transient' | 'unknown'`, and **`unknown` is a third answer on purpose**: ADR-18
retries an unrecognised error a little and then parks it, which needs a lower attempt cap than a
failure positively classified as transient. Collapsing the two silently gives every unrecognised
error the full retry budget.

It decides in this order:

1. `instanceof PipelineError` - our own classes answer for themselves.
2. `name === 'UnrecoverableError'` - the one foreign class recognised structurally. `bullmq` is
   confined to `packages/server/adapters/**`, so `apps/worker` and the in-memory queue double
   *cannot* import it. The BullMQ adapter, which may, uses a real `instanceof`.
3. `RETRY_CLASS[code]` for anything carrying a code.
4. Otherwise `unknown`.

**Never read a class name, a message or an `isRetryable` field yourself.**
`tests/architecture/class-name-inference.test.ts` fails on `.name === 'SomethingError'`, on
`.isRetryable ===`, and on comparing `.code` to a bare string that is an `ErrorCodes` member instead
of the member itself. The one allowlisted exception is `packages/server/adapters/s3/`: AWS SDK v3
generates a service-exception class per command, so `instanceof` is unreliable across sub-package
versions and `name` is what the SDK documents.

## The frontend contract

Not implemented yet. Tickets 53, 70 and 71 build against this; what is decided here is the shape.

```
user types / drops a file
  └─ validateStartUpload(input, limits)          <- @vp/validation, runs in the browser
       ├─ err -> toast / field error, NO network call        <- optimistic, ~5 ms
       └─ ok  -> POST /v1/uploads
                  └─ apps/api runs validateStartUpload(input, limits)  <- THE SAME FUNCTION
                       ├─ err -> presentStartUpload(failure) -> Problem
                       └─ ok  -> UploadService.initiate(...)
```

**The browser copy is a latency and UX optimisation, never the authority.** A client can always be
bypassed, so the backend re-runs the rule unconditionally - and "re-runs it" means the identical
imported function, not a second implementation that drifts. That drift is the current state: the
upload form hardcodes `{ 'video/mp4': ['.mp4'] }` while the API allowed four container types, and
the form had no size check at all, so a user could wait out a 6 GB upload to be told
`UPLOAD_TOO_LARGE` at the end.

### The component holds no logic

State, rule evaluation, submission and the failure-to-presentation mapping all live outside the
component. A component receives a view state and renders it; it decides nothing.

```ts
export function useStartUpload() {
  const limits = useUploadLimits();
  const [state, setState] = useState<ViewState<StartedUpload, StartUploadFailure>>({ status: 'idle' });

  const submit = async (input: StartUploadInput) => {
    const validated = validateStartUpload(input, limits);       // the shared rule
    if (isErr(validated)) return setState(present(validated.error));   // no network call

    setState({ status: 'loading' });
    const sent = await uploadsClient.start(validated.value);
    setState(isOk(sent) ? { status: 'success', data: sent.value } : present(sent.error));
  };

  return { ...state, submit };
}
```

- **`ViewState`** is the shape every hook returns:
  `{ status: 'idle' | 'loading' | 'success' | 'error'; data?: T; failure?: E; fieldErrors?: Record<string, string> }`.
- **`present(failure)`** is the frontend's total `switch` with `assertNever` in the `default` - the
  mirror of the backend presenter, and the reason a new failure variant breaks the frontend build too.
- **The component is `({ status, data, failure, submit }) => JSX`.** No `useEffect` calling an API,
  no `try/catch`, no `if (failure.code === ...)`, no validation literal. If a component needs a rule,
  it needs a hook.

**Success is extracted too, not just failure.** The happy path is as much logic as the error path:
the hook decides what success means - navigate, invalidate a query, reset the form, fire the next
request in a sequence.

### Two consumers, one rule, different handling

| Consumer | Same `validateStartUpload` | `UNSUPPORTED_CONTENT_TYPE` becomes |
|---|---|---|
| upload page | yes | an inline field error under the dropzone, form stays open |
| creator-studio bulk import | yes | a toast, that row marked failed, the queue continues |

Neither touches the rule. That is the reason a rule returns a `Result` instead of rendering,
throwing or logging - stated here so the next reader does not "simplify" it by moving a message into
the rule.

**The frontend and the backend share the rule, never the presenter.** A `Problem` and a toast are
different answers to the same failure, and a shared presenter would force one of them to win.
`present()` and `presentStartUpload()` are deliberate near-duplicates over the same switch; the
exhaustiveness check keeps them in step, not a shared implementation.

### Limits are data

Validation is parameterised, so the frontend needs `MAX_UPLOAD_BYTES` and the allowed content types
as values. Whether that is a field on an existing response or a small `GET /v1/config` is ticket 53's
call. What is decided here: **the limit is supplied to the rule, never baked into it.**

## What the machine checks

Every resource is converted, so the three shrink-only allowlists that carried the migration are
gone and their assertions are flat:

| Assertion | Test |
|---|---|
| Every I/O method on a `@vp/core` port or repository returns `Promise<Result<T, InfraFailure>>` | `result-returning-ports.test.ts` |
| No rule, service or stage throws its failure, and no helper converts one into a throw | `no-domain-throw.test.ts` |
| `catch` appears only in `@vp/result`, in an adapter, or at a boundary the list still names | `catch-confinement.test.ts` |
| `sendResult` is the only unwrap point under `routes/`, and a route imports no port | `routes-unwrap-at-send-result.test.ts` |

`legacy-catch-sites.ts` is the one list left, and nothing on it is waiting on a conversion: it holds
the `@vp/ffmpeg` process boundary and telemetry setup. The CLIs, `apps/web` and the build and
migration entrypoints convert through `tryCatch` / `fromPromise`; a CLI keeps only its
`main().catch(...)` exit-code handler.
