# 170: Platform packages - reusable, app-independent, extractable; the app registers its data through injection tokens

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL (one PR, ordered commits, see *Delivery*) |
| Blocked by | 82 - Architecture remediation · 85 - Universal intl and message core · 86 - Localisation rollout · 87 - Composition root and typed container · 88 - Codebase health ratchets · 131 - Front-end folder structure |
| Blocks | 48, 171 |
| Spec | [packages/AGENTS.md](../../packages/AGENTS.md) · [ARCHITECTURE.md section 6](../../ARCHITECTURE.md#6-verification--enforcement) · [SDD ADR-23](../SDD.md#adr-23--package-runtime-tiers-the-directory-is-the-tier) · [SDD ADR-25](../SDD.md#adr-25--composition-one-container-configuration-is-a-value) · [87](87-composition-root-typed-container-config-value.md) · [85](85-universal-intl-formatting-message-core.md) · [86](86-localisation-rollout-locale-negotiation-rtl.md) · [48](48-project-rebrand-cli-unification.md) |

**Status:** ready

> **Start condition.** The two PRs in flight now (#329 for [113](113-channel-comment-moderation.md), #326 for
> [136](136-frontend-ui-and-feel-overhaul-web-and-studio.md)) are assumed to merge first; this ticket starts only when no
> other large front-end or backend ticket is in flight (*Sequencing*). Package names below are today's `@vp/*`.

## Why

Half of the shared packages cannot be reused in another product, because they know this one. Measured on `main`
(2026-11-10; 45 packages under `packages/universal`, `packages/client`, `packages/server`) and on the two open PRs:

- `@vp/messages` imports the app's error codes (`src/error-copy.ts`, `src/create-translator.ts`) and defines the locales
  and all the words (`src/locales.ts`: `SUPPORTED_LOCALES = [FALLBACK_LOCALE, 'pl']`; `src/en/` 26 files, `src/pl/` 27).
- `ErrorCode` / `ErrorCodes` is imported by production source in 18 packages (`api-contracts` 45 files, `domain-rules` 20,
  `queries` 6, `ffmpeg` 5, `whisper` 4, ...); the list is a fixed global, not something an app registers.
- Constants of this product sit inside libraries: `@vp/ui` (`vp.appearance`, `vp.theme` cookies in
  `src/appearance/preference.ts`, the wordmark `taitube` in `src/primitives/logo/logo.tsx`, a fixed `UI_COPY_KEYS`),
  `@vp/queries` (`vp.session` in `src/session-cookie.ts`, `errorPage.*` and `ui.retry` keys in `src/route-errors.tsx`,
  `src/use-failure-toast.ts`), `@vp/events` (`NAMESPACE = 'taitube'`, `src/keys.ts`), `@vp/observability` (`'vp_'` prefix,
  `TRACER_NAME = 'video-pipeline'`, `PipelineMetrics`), `@vp/dev-token` (`vp-dev`, `vp-api`, `vp-dev-key-1`),
  `@vp/web-telemetry` (`taitube-${app}`), `@vp/testing` (`AUTH_AUDIENCE: 'taitube'`), `@vp/compose-autoscaler`
  (video-pipeline stage defaults), `@vp/intl/src/domain/` (8 formatters of this product: views, subscribers, resolution ...).
- `@vp/config` is hard-wired to `AppEnvSchema` (`src/load-env.ts`); `@vp/env-schema` mixes reusable helpers with this
  app's 100+ keys.
- No package is extractable today: all 10 `universal` manifests dev-depend on `@vp/testing` (a `server` package) and
  extend `@vp/tsconfig`; none declares `peerDependencies`; only `permissions` has a README; the scope `@vp` names the
  project.
- Nothing stops it growing: `packages/AGENTS.md` section 6 says deep relative imports are "not currently asserted", and
  no test reads a library for app data. The two PRs in flight add to the problem (*What is coming in*).

## What a platform package is

**The core definition: a platform package could be copied into another repository, installed, and used at once, like an
npm package.** Everything else follows from it. A platform package has:

1. **A self-contained manifest**: `name`, `version`, `exports` map, `types`, `sideEffects`, `peerDependencies` for
   anything the host must provide (the app's `zod`, `@casl/ability`, `pino`, React, OpenTelemetry), and a dependency on
   no workspace package except other platform packages.
2. **No app vocabulary**: no app or brand name, no env key, no route, no cookie name, no hard-coded domain data, no
   relative path leaving its folder, no import of an app-side package or of an app.
3. **Its own tsconfig** extending only `@kit/tsconfig` (a platform package) and its own test setup, plus a README and an
   `AGENTS.md` with install, the tokens it consumes, the registries it exposes, and a usage example.
4. **Registration, not knowledge**: what it needs from an app is a typed token (`@kit/di`); the app provides it at its
   composition root.

An **app package** is the product's own shared code (`domain`, `api-contracts`, `core`, `db`, ...): free to depend on
platform packages, never the reverse. The hard rule, enforced by `pnpm boundaries`: **a platform package never depends
on an app package, and never imports app data.**

## What to build

1. **The directory axis.** `packages/platform/<tier>/<name>` for platform packages; `packages/<tier>/<name>` stays for
   app packages. The directory is the scope as it is the tier. Section *Folder layout*.
2. **`@kit/di`** (`packages/platform/universal/di`) and `@kit/di-react` (`.../client/di-react`): typed tokens, registry,
   provider. Section *Design*.
3. **Generalise 32 platform packages**: 17 move whole, 12 come out of splits (platform engine plus the app's data, each
   with a path), 3 are new (`di`, `di-react`, `runtime`). The survey gives every verdict.
4. **The layered translation model** and the type-safe engine (`@kit/i18n`).
5. **Extractability in CI**: a check that copies each platform package out of the repo, installs, typechecks and tests it
   there, and a second dummy app that consumes the extracted packages.
6. **Architecture tests** that fail the build on a platform package that depends on an app package or hard-codes app data.
7. **A generated package map** and the docs hardening (acceptance criterion 22).

## Folder layout

### Alternatives and recommendation

| Option | For | Against |
|---|---|---|
| **(a) a second directory axis** `packages/platform/<tier>/*` and `packages/<tier>/*` (recommended) | the scope is visible in the file tree; `cp -r packages/platform` is the reuse story; one glob per axis; matches "the directory IS the tier", so no field can disagree with the path | moves 17 packages whole and creates 14 new ones; every path literal changes (64 files under `tests/`, 28 under `scripts/`, 38 under `packages/`, 50 under `docs/`, 3 workflow files, 7 root configs) |
| (b) keep `packages/<tier>/*`, add `vp.scope: platform \| app` in `package.json` | nothing moves | a field can disagree with the folder; a person cannot see the line; extraction needs a manifest scan, not a `cp` |
| (c) `packages/lib/*` and `packages/app/*` (move all 45) | clearest names | moves every package, including the 16 that stay, for no gain; collides with the tier directories' meaning |

Recommended: (a), moving only what is platform: app packages stay where every importer, `Dockerfile`, filter and doc
already finds them, so the diff is the platform half plus the splits. There is no `vp.scope` field: the directory is
the scope, the same reason there is no `vp.tier`.

### Target tree

```
packages/
  platform/                                   reusable, app independent (the rule: depends on platform only)
    universal/  result  errors  intl  i18n  pagination  validation  permissions  design-tokens  primitives  di  runtime  tsconfig
    client/     ui  components  forms  intl-react  di-react  security-headers  web-telemetry  query
    server/     composition  logger  concurrency  keyspace  observability  config  dev-token  testing
                object-storage  compose-autoscaler  vite-preset  ports
  universal/    domain  api-contracts  domain-rules  error-codes  input-rules  permission-rules  intl-formats  shared-messages
  client/       api-client  permissions-react  queries  web-testing  workbench
  server/       core  db  adapters  job-contracts  env-schema  events  storage  pipeline-metrics  testing-fixtures
                ffmpeg  whisper  lighthouse  stack  upload-client  gen-video
apps/
  server/       api  worker
  client/       web  studio                    each owns src/lib/messages/ (its own catalogue)
```

Scope of names: platform packages take a neutral scope, `@kit/*` (placeholder, owner picks, *Decisions*); app packages
keep `@vp/*` until [48](48-project-rebrand-cli-unification.md) renames them to `@taitube/*`. The tier rules and
`vp.layer` are unchanged and read the same way under both axes (`packages/platform/<tier>/<name>` is tier `<tier>`).

### Mapping, every old package to its new home

`W` = moves whole (a `git mv`, then the scope rename); `S` = split; `N` = new; `=` = stays.

| Old | New platform | New app side | |
|---|---|---|---|
| `universal/result` | `platform/universal/result` `@kit/result` | | W |
| `universal/tsconfig` | `platform/universal/tsconfig` `@kit/tsconfig` | | W |
| `universal/pagination` | `platform/universal/pagination` `@kit/pagination` (limits by token) | | W |
| `universal/design-tokens` | `platform/universal/design-tokens` `@kit/design-tokens` | | W |
| `universal/errors` | `platform/universal/errors` `@kit/errors`: `Failure`, `classify`, retry-class engine, `PermanentError` / `TransientError`, `defineErrorCodes` | `universal/error-codes` `@vp/error-codes`: `api-error-codes`, `pipeline-error-codes`, `error-codes`, `*-failures`, status map | S |
| `universal/intl` | `platform/universal/intl` `@kit/intl`: formatters, `create-intl`, `locale-chain`, `failures` | `universal/intl-formats` `@vp/intl-formats`: `src/domain/*` (views, subscribers, published-at, video-duration, resolution, comment-count, upload-progress, file-size) | S |
| `universal/messages` | `platform/universal/i18n` `@kit/i18n`: `define`, `create-translator`, `substitute`, `catalogue` (generic), kinds, presets, locale registry | `universal/shared-messages` `@vp/shared-messages` plus the catalogues inside `apps/client/web` and `apps/client/studio` | S |
| `universal/validation` | `platform/universal/validation` `@kit/validation`: `failures.ts`, `plain-text.ts`, validator helpers | `universal/input-rules` `@vp/input-rules`: the 14 per-resource folders | S |
| `universal/permissions` | `platform/universal/permissions` `@kit/permissions`: `ability.ts`, `errors/assert-can`, `normalizers`, rule-set registration token | `universal/permission-rules` `@vp/permission-rules`: `rules/*.rules.ts`, `helpers/<resource>.ts`, the subjects | S |
| `universal/domain` | `platform/universal/primitives` `@kit/primitives`: `time.ts` and any other generic found by the commit 1 scan | `universal/domain` `@vp/domain`: entities, `status-vocabulary` | S |
| `universal/api-contracts`, `domain-rules` | | stay | = |
| (new) | `platform/universal/di` `@kit/di`; `platform/universal/runtime` `@kit/runtime` (environment tokens, `node` and `browser` entries) | | N |
| `client/ui` | `platform/client/ui` `@kit/ui` (cookies, brand, copy, themes by token) | | W |
| `client/components`, `forms`, `intl-react`, `security-headers`, `web-telemetry` | `platform/client/<same>` `@kit/<same>` | | W |
| `client/queries` | `platform/client/query` `@kit/query`: `create-query-client`, `retry-policy`, `single-flight-refresh`, `keyset-paging`, `ensure-found`, `parse-param`, `section-boundary`, the session machinery behind `SessionConfig` | `client/queries` `@vp/queries`: `video-queries`, `clip-queries`, `user-event-handlers`, `use-live-*`, `api-proxy` | S |
| (new) | `platform/client/di-react` `@kit/di-react` | | N |
| `client/api-client`, `permissions-react`, `web-testing`, `workbench` | | stay (commit 1 checks whether `api-client`'s `client.ts` and `request.ts` take the contract by parameter, then they move) | = |
| `server/composition`, `logger`, `concurrency`, `dev-token`, `compose-autoscaler`, `vite-preset`, `config` | `platform/server/<same>` `@kit/<same>` (`config`: `loadEnv(schema, env)` plus the env helpers) | | W |
| `server/events` | `platform/server/keyspace` `@kit/keyspace`: `createKeyspace(namespace)`, channel helpers | `server/events` `@vp/events`: `CacheKeys`, the product's channels | S |
| `server/observability` | `platform/server/observability` `@kit/observability`: registry, tracing, sampler, server | `server/pipeline-metrics` `@vp/pipeline-metrics`: `PipelineMetrics`, captions, playback, web-vitals groups | S |
| `server/env-schema` | its helpers (`secret`, `commaList`, `optionalUrl`, redaction) go into `@kit/config` | `server/env-schema` `@vp/env-schema`: the keys | S |
| `server/testing` | `platform/server/testing` `@kit/testing`: vitest config factory, `log-capture`, `result`, `run-entrypoint`, `jwt` | `server/testing-fixtures` `@vp/testing-fixtures`: `env.ts` (`AUTH_AUDIENCE: 'taitube'`, `idp.vp.local`) | S |
| `server/storage` | `platform/server/object-storage` `@kit/object-storage`: `mime`, `multipart` | `server/storage` `@vp/storage`: `keys.ts` (`raw/`, `videos/`, HLS layout) | S |
| `server/core` | `platform/server/ports` `@kit/ports`: the infrastructure ports `cache-client`, `job-queue`, `flow-producer`, `health-checkable`, `database-client` with contract suites (only if the commit 1 scan finds no product type in their signatures) | `server/core`: the product's ports and repositories | S |
| `server/db`, `adapters`, `job-contracts`, `ffmpeg`, `whisper`, `lighthouse`, `stack`, `upload-client`, `gen-video` | | stay | = |

Totals: 45 old packages = 17 whole moves + 13 splits + 15 that stay; plus 3 new platform packages; the platform side
ends at **32 packages** (12 universal, 8 client, 12 server) and the app side gains 7 new packages from the splits
(`error-codes`, `intl-formats`, `shared-messages`, `input-rules`, `permission-rules`, `pipeline-metrics`, `testing-fixtures`).

## Survey: extractability and verdict, every package

Measured by `package.json` import edges, `grep` for `ErrorCode`, `taitube`, `vp.`, `vp_`, `video-pipeline`, and a read of
the key files. **Common blockers for every package today** (not repeated below): the manifest has no `peerDependencies`
(0 of 45); each of the 10 `universal` manifests dev-depends on `@vp/testing`, a `server` package, and every package extends
`@vp/tsconfig`; only `permissions` has a README; the scope `@vp` is the project's. A cell with `+PR` is an offender the
open PRs make worse. Verdicts: **P** platform (moves or splits), **A** app (stays, on purpose), `ok` already free of app data.

### Priority packages (the owner's list), exact blockers

| Package | Extractable now? | Blockers beyond the common ones (evidence) | Seam | Verdict |
|---|---|---|---|---|
| `result` | after the common fixes | none | - | P (W) |
| `errors` | no | the whole code list: `src/api-error-codes.ts`, `pipeline-error-codes.ts`, `*-failures.ts` (12 files); consumed by 18 packages; `+PR` 113 adds 10 codes (`COMMENTS_BANNED`, `COMMENTS_SLOW_MODE`, ...) | `ErrorCodeRegistry`, `defineErrorCodes` | P (S) |
| `intl` | no | `src/failures.ts` imports `ErrorCodes` from `@vp/errors`; `FALLBACK_LOCALE = 'en'` in `locale-chain.ts`; `src/domain/` 8 product formatters | `LocaleRegistry`, `FormatPresets` | P (S) |
| `messages` (engine) | no | `error-copy.ts`, `create-translator.ts` import `@vp/errors`; `locales.ts` holds locales; 55 files of words; `+PR` 113: 174 new entries (975 added lines en and pl) | `LocaleRegistry`, `defineEngine`, catalogue provided by the app | P (S) |
| `pagination` | no | depends on `@vp/errors`; `PAGE_SIZE_DEFAULT = 20`, `PAGE_SIZE_MAX = 100` | `PaginationLimits` | P (W) |
| `validation` | no | 14 per-resource folders of this product's bodies; imports `@vp/errors` | validators take codes from the registry | P (S) |
| `permissions` (engine) | no | CASL rules over `Video`, `Channel`, `Comment` (`src/rules/*.rules.ts`, `helpers/*`); `@casl/ability` is a plain dependency, must be a peer; `+PR` 113 edits `ability.ts` and adds `helpers/comment-moderation.ts` | `RuleSets` token | P (S) |
| `design-tokens` | no | dependencies on `@vp/domain` and `@vp/errors`; `zod` must be a peer; `+PR` 136 edits 11 files | drop the two edges | P (W) |
| `domain` primitives | no | `time.ts` (`MS_PER_SECOND` ...) is generic; `status-vocabulary.ts` (`VIDEO_STATUSES`) and 43 more files are not | split | P (S) |
| `composition` | no | `Token` is server-only so a browser package cannot declare one; no `sideEffects` flag | `Token` moves to `@kit/di` | P (W) |
| `logger` | after the common fixes | `pino`, `@opentelemetry/api` are dependencies, should be peers; no `sideEffects` flag; `service` already an argument | - | P (W) |
| `concurrency` | after the common fixes | no `sideEffects` flag only | - | P (W) |
| `events` | no | `NAMESPACE = 'taitube'` (`keys.ts`), every `CacheKeys` entry is product data; `+PR` 113 adds `commentSlowMode` (`taitube:comments:slow:...`) | `KeyNamespace` | P (S) |
| `observability` | no | `PROCESS_METRICS_PREFIX = 'vp_'` (`metrics.ts`), `TRACER_NAME = 'video-pipeline'` (`tracing.ts`), `PipelineMetrics` of 30 product metrics; 11 external dependencies to become peers; `+PR` 136 edits 3 files | `MetricsConfig`, `MetricGroup` | P (S) |

### Every other package

| Package | App specific in it (evidence) | Seam | Verdict |
|---|---|---|---|
| `tsconfig` | none | - | P (W) |
| `ui` | `vp.appearance`, `vp.theme` cookies (`appearance/preference.ts`), wordmark `taitube` (`primitives/logo/logo.tsx`), `UI_COPY_KEYS`; `+PR` 136 edits 31 files (themes, `register-theme.ts`) | `AppearanceStorage`, `BrandMark`, `UiCopy` tokens, theme registry | P (W) |
| `query` (from `queries`) | `vp.session` (`session-cookie.ts`), `errorPage.*` and `ui.retry` keys (`route-errors.tsx`, `use-failure-toast.ts`), `app-words.tsx`; `+PR` 113 edits 14 files, 136 edits 16 | `SessionConfig`, `FailureCopy` | P (S) |
| `intl-react` | imports `@vp/messages` in 5 files | takes the registry from the provider | P (W) |
| `web-telemetry` | `taitube-${app}` (`use-web-telemetry.ts`); `+PR` 136 edits 5 files | `TelemetryConfig` | P (W) |
| `components`, `forms`, `security-headers` | none found | - | P (W), ok |
| `config`, `env-schema` | `loadEnv` fixed to `AppEnvSchema` (`load-env.ts`); keys, `platform-env.json` | `EnvSchema` token | P (W) and P (S) |
| `dev-token` | `vp-dev`, `vp-api`, `vp-dev-key-1` (`jwt.ts`, `keys.ts`, `cli.ts`); `+PR` 136 edits 3 files | `DevTokenConfig` | P (W) |
| `testing` | `AUTH_AUDIENCE: 'taitube'`, `idp.vp.local` (`env.ts`) | fixtures leave | P (S) |
| `storage` | `rawPrefix`, `videoPrefix`, HLS layout (`keys.ts`); `mime.ts`, `multipart.ts` generic | key layout leaves | P (S) |
| `compose-autoscaler` | defaults for this app's worker stages (`scaler.ts`) | `AutoscalerConfig` | P (W) |
| `vite-preset` | none found; `+PR` 136 edits 7 files | - | P (W), ok |
| `domain`, `api-contracts`, `domain-rules` | the product's entities, HTTP API (51 files, 5.1k lines), rules | - | A |
| `api-client`, `permissions-react`, `web-testing`, `workbench` | typed over this API and its subjects; the harness and Storybook of this product | - | A |
| `core` (product ports), `db`, `adapters`, `job-contracts`, `ffmpeg`, `whisper`, `lighthouse`, `stack`, `upload-client`, `gen-video` | ports, schema, drivers, queue names (`QUEUES` in `job-contracts/src/index.ts`; `+PR` 113 edits 3 files), ladder, tools of this product | - | A |

Counts: **32 platform** (17 W, 12 from splits, 3 N; `env-schema`'s helpers join `config`), **15 app packages unchanged**,
7 new app packages from the splits; 9 platform packages are already clean of app data and only need the manifest work.

### What is coming in with the open PRs

Counted with `git diff --stat origin/main...<head>`:

| PR | Size | Adds to a package this ticket generalises |
|---|---|---|
| #329, [113](113-channel-comment-moderation.md) (draft) | 628 files, +37.5k | 10 error codes (`errors`, 2 files); about 174 message entries (975 added lines) in new `studio-batch`, `studio-comment-settings`, `studio-comments`, `studio-moderation`, `studio-team` and in `watch` (+106), `library`, `notifications`, `errors` (+10), `ui` (+8), en and pl; `ERROR_COPY` +10; `permissions` (`ability.ts`, `helpers/comment-moderation.ts`); `events/keys.ts` (+1 `taitube:` key); `job-contracts/notifications`; `core` 13, `db` 13, `adapters` 107 files; `queries` 14; 0 env keys, 0 new packages |
| #326, [136](136-frontend-ui-and-feel-overhaul-web-and-studio.md) slice a (draft) | 1762 files, +7.0k and -3.8k (1516 are `workbench` snapshots) | `ui` 31 files (themes `sand`, `nocturne`, `register-theme.ts`, appearance), `design-tokens` 11, `queries` 16, `vite-preset` 7, `web-telemetry` 5, `observability` 3, `dev-token` 3, `security-headers` 2, `env-schema` 1; 0 codes, 0 messages |

Expected next: [129](129-multiple-accounts-and-channels.md) (multiple accounts) reads and rewrites the session
(`vp.session` in `queries`, a per-tab identity), `auth` and `shell` words, `permissions` subjects and new error codes;
[138](138-type-aware-lint-backlog.md) edits source in most packages. Both overlap this ticket's steps (*Sequencing*).

## Translations: the layers, the namespace-by-namespace assignment, the moves

### Measured today

`@vp/messages` has 55 source files (26 under `src/en/`, 27 under `src/pl/`, the extra one is `pl/settings-rows.ts`),
1.5k lines of English. Importers of the package: `apps/client/web` 6 files, `packages/client/intl-react` 7,
`packages/client/queries` 6, `packages/client/workbench` 3; `apps/client/studio` 0 directly (it reaches the words
through `intl-react` and `queries`), `apps/server/api`, `apps/server/worker` and every `packages/server` package 0.
`tests/architecture/messages-are-client-only.test.ts` forbids a server import (ADR-24: the API returns a code, the
client chooses the words); no server code renders user-facing text today.

Usage evidence below is `grep -E "['\"\`]<ns>\.[a-zA-Z]+"` over non-test `.ts`/`.tsx`, as hits (web = `apps/client/web/src`,
studio = `apps/client/studio/src`, pkgs = `packages/client/{ui,components,forms,intl-react,queries,permissions-react,web-telemetry}`
and `packages/universal/{api-contracts,domain-rules,validation,intl}`). A key built at run time (`ui.${key}` in
`queries/src/app-words.tsx`) is invisible to it; commit 1 of the PR re-measures with a type-aware scan and any row it
changes is shown in the PR.

### The layers

1. **`@kit/i18n`** (`packages/platform/universal/i18n`, universal, T3): the engine, no strings, no locale data, no `@vp/errors`.
   Moved here from `messages`: `define.ts`, `create-translator.ts`, `substitute.ts`, `catalogue.ts` (made generic over
   the catalogue the app registers, no `import type { en }`). New: `engine.ts`, `kinds/`, `presets/`,
   `locale-registry.ts` (see *Type safety*).
2. **`@vp/shared-messages`** (`packages/universal/shared-messages`, universal, app side, T4): only keys that two
   apps, or an app and a server, use. Source `src/en/`, `src/pl/`, `provide-shared-messages.ts`. A server may import
   it (it is universal and has no `node:*`).
3. **Per-app catalogues**, owned and registered by the app: `apps/client/web/src/lib/messages/{en,pl}/<namespace>.ts`
   and `apps/client/studio/src/lib/messages/{en,pl}/studio*.ts`, each with `index.ts` (the catalogue value),
   `locales.ts` (the app's `defineLocales`) and `i18n.ts` (`createI18n<AppCatalogue>()`: the typed `t`, `useT`,
   `tOr` for that app). The two `i18n.ts` differ by their catalogue import, so the byte-identical guard
   (`client-app-duplicates`) is not tripped; a registry fixture proves it.
4. **Platform packages ship no words.** `@kit/ui`, `@kit/components`, `@kit/forms`, `@kit/intl-react` and `@kit/query` take every label and message from the app: through props, or a typed `UiCopy` / `FailureCopy` token that has **no default and no English fallback**. A missing provision is a compile error (the provider's `copy` prop is required and typed over the kit's closed key list) or a startup error (`registry.get` returns `MissingProvider`, which the app root turns into a boot failure). The kit exports its key list (`UI_COPY_KEYS`, `FAILURE_COPY_KEYS`) and the app's shared catalogue implements it.
5. **Server-only text** (the Discord bot and bridge, [78](78-discord-integration-bot-watch-together-activity-creator-alerts.md),
   [142](142-discord-party-bridge.md)) is not shared by definition: it lives with the server app that renders it, on the
   same `@kit/i18n` engine. No `@vp/server-messages` package is created until a text is shared by two server apps.

### Assignment, every file under `packages/universal/messages/src/en/` (and its `pl/` twin)

Owner is one of `web` | `studio` | `app-shared (FE only)` (web and studio) | `app-shared with BE` (a client and a server). None is platform: a platform package ships no words.

| File (en lines) | Namespace | Evidence (web / studio / pkgs) | Owner | Moves to |
|---|---|---|---|---|
| `auth.ts` (10) | `auth` | 10 / 6 / 0; all 6 keys (`signIn`, `signOut`, `expired`, `noProvider`, `admin`, `upload`) read by both apps | app-shared (FE only) | `shared-messages/src/{en,pl}/auth.ts` |
| `browse.ts` (7) | `browse.untitled` | 19 / 9 / 0; studio reads only `untitled` | app-shared (FE only) (that key) | `shared-messages/.../browse.ts` |
| `browse.ts` | `browse.empty`, `browse.loadMoreFailed` | web only | web | `web/src/lib/messages/{en,pl}/browse.ts` |
| `videos.ts` (19) | `videos.views`, `videos.visibility` | 11 / 9 / 1; both apps read both keys | app-shared (FE only) | `shared-messages/.../videos.ts` |
| `videos.ts` | `videos.moreLikeThis`, `videos.resolution` | web only | web | `web/.../videos.ts` |
| `videos.ts` | `videos.publishedRelative`, `categories`, `rank` | no literal call site found (computed or unused) | web until commit 1 proves otherwise; an unused key is deleted | `web/.../videos.ts` |
| `errors.ts` (84) | `errors` | 0 / 3 / via `ERROR_COPY` in `queries/present-failure.ts` and web `live-stream-chat.tsx`; 0 server importers today | app-shared with BE (keyed by the app's error-code registry; the API already owns the codes, ADR-24 keeps rendering client-side until a server needs it) | `shared-messages/.../errors.ts` |
| `error-page.ts` (12) | `errorPage` | 0 / 0 / 7, all in `queries/src/route-errors.tsx`, which both apps render | app-shared (FE only): `@kit/query` renders it through the `FailureCopy` token | `shared-messages/.../error-page.ts` |
| `ui.ts` (135) | `ui` | 0 / 0 / 1 literal (`ui.retry`) plus the run-time `ui.${key}` in `queries/src/app-words.tsx`, which both apps mount | app-shared (FE only): `@kit/ui` gets it through the required `UiCopy` token, filled by `queries/app-words.tsx` in both apps | `shared-messages/.../ui.ts` |
| `channels.ts` (21) | `channels` | 13 / 0 / 0 | web | `web/.../channels.ts` |
| `clips.ts` (31) | `clips` | 23 / 0 / 0 | web | `web/.../clips.ts` |
| `home.ts` (37) | `home` | 19 / 0 / 0 | web | `web/.../home.ts` |
| `library.ts` (111) | `library` | 40 / 0 / 0 | web | `web/.../library.ts` |
| `live.ts` (33) | `live` | 22 / 0 / 0 (the 10 package hits are SSE event names such as `'live.viewers'`) | web | `web/.../live.ts` |
| `notifications.ts` (9) | `notifications` | 6 / 0 / 0; typed payloads rendered client side ([99](99-notifications.md)) | web | `web/.../notifications.ts` (to app-shared with BE only if a server renders them) |
| `player.ts` (25) | `player` | 25 / 0 / 0 | web | `web/.../player.ts` |
| `pwa.ts` (45) | `pwa` | 24 / 0 / 0 | web | `web/.../pwa.ts` |
| `search.ts` (51) | `search` | 27 / 0 / 0 | web | `web/.../search.ts` |
| `settings.ts` (247), `pl/settings-rows.ts` | `settings` | 110 / 0 / 0 | web | `web/.../settings.ts`, `settings-rows.ts` |
| `shell.ts` (21) | `shell` | 19 / 0 / 0 | web | `web/.../shell.ts` |
| `shorts.ts` (11) | `shorts` | 5 / 0 / 0 | web | `web/.../shorts.ts` |
| `theme-builder.ts` (15) | `themeBuilder` | 7 / 0 / 0 | web | `web/.../theme-builder.ts` |
| `watch.ts` (30) | `watch` | 28 / 0 / 0 | web | `web/.../watch.ts` |
| `studio.ts` (225) | `studio` | 0 / 406 / 0 | studio | `studio/src/lib/messages/{en,pl}/studio.ts` |
| `studio-admin.ts` (156) | `studio.admin` (nested in `studio.ts`) | studio only | studio | `studio/.../studio-admin.ts` |
| `studio-live.ts` (87) | `studio.live` | studio only | studio | `studio/.../studio-live.ts` |
| `studio-picks.ts` (53) | `studio.picks` | studio only | studio | `studio/.../studio-picks.ts` |
| `index.ts` (45) | the `en` / `pl` aggregate | - | deleted; each owner has its own `index.ts` | - |

Result: the app-shared layer holds 6 files (`auth`, `browse`, `videos`, `errors`, `error-page`, `ui`), about 270 of the 1.5k lines; web takes 16 files and studio 4. `errors` is the only namespace shared with the backend, because it is keyed by the code registry the API already owns; the layer exists so 78 and 142 do not copy it. No platform package holds a string.

### Order of the moves in the single PR (each commit green)

1. Measure: the type-aware usage scan, the table above re-confirmed, committed as a fixture the architecture test reuses.
2. Add `@kit/i18n` with the engine moved over (`messages` re-exports nothing; importers switch in the same commit).
3. Type-safety work in `@kit/i18n` (next section), with its type-level specs.
4. `@vp/shared-messages`: `auth`, `browse.untitled`, `videos.{views,visibility}`, `errorPage`, `ui`, and `errors` keyed by `@vp/error-codes`.
5. Studio: `studio*` files to `apps/client/studio/src/lib/messages/`, studio's `createI18n`, locales, providers.
6. Web: the web namespaces to `apps/client/web/src/lib/messages/`, same wiring.
7. `@kit/ui`, `@kit/query`, `@kit/forms`, `@kit/components` lose any built-in word and take `UiCopy` / `FailureCopy` / props (the existing `ui-copy.tsx` English defaults are removed); `intl-react` takes the registry; `workbench` stories supply a copy fixture.
8. Delete `@vp/messages` and `messages-are-client-only.test.ts`; add `translation-layers.test.ts`; update
   `catalogue-parity`, `error-copy-coverage` and `single-locale-source` to read each app's registered value.

## Type safety of messages

### What holds today (read in `define.ts`, `catalogue.ts`, `create-translator.ts`, the architecture tests)

- `Params` reads each argument's type off its token (`{count:plural}` is a `number`, `{when:date}` an ISO `string`,
  `{items:list}` a `readonly string[]`, `{kind:enum}` one of the labels the config declares). Holds.
- `t(key, args)` has a typed key and typed args, but from `typeof en` imported inside `catalogue.ts`, i.e. the
  package's own catalogue, not one the app registered. Partly holds.
- Every locale holds `en`'s keys (`catalogue-parity.test.ts`, keys only, at run time); `ERROR_COPY` is total over
  `ErrorCode` and points at argument-free keys (compile time, plus `error-copy-coverage.test.ts`). Hold.
- A missing plural config is caught at run time only (`substitute.ts`: `no plural branches for count`).
- Existing invariants (`messages/AGENTS.md` section 2) that stay: the template is the type; the grammar is flat;
  every placeholder renders through `@vp/intl`; `t` returns a `Result`; the chain is walked per key; every catalogue
  holds `en`'s keys; `ERROR_COPY` is total. They move to the `@kit/i18n` AGENTS.md.

### Gaps, each confirmed in the source

- **G1.** `dt('{count:plural} views')` compiles with no config, and a config with keys that match no token compiles;
  `Message.config` is `MessageConfig`, not derived from the template.
- **G2.** `PluralBranches` requires `other`, but only once a config is written (G1); branch keys are typed, a branch
  text is a free `string`, so `{?}` is not validated and a stray `{name}` inside a branch is accepted.
- **G3.** A locale may omit categories it needs: `pl` needs `one`, `few`, `many`, `other`, and nothing checks that
  against `Intl.PluralRules`. `catalogue-parity` compares keys only.
- **G4.** A translation is typed `PartialCatalogue` with plain `Message`, so its `Params` are never compared with the
  source locale's: a `pl` message may drop or rename an argument.
- **G5.** Param names are `\w+` (`{0}`, `{count2}`, `{Name}`, `{a_b}` all pass), duplicates across kinds intersect
  silently, and `{name}` beside `{name:number}` collapses to `number` with no error.
- **G6.** Formatter config is typed per kind (`NumberOptions`, `DateOptions`, `ListOptions` from `@vp/intl`), but every
  message repeats its options inline; there are no named presets and no per-locale option sets.
- **G7.** The kinds are a closed list inside the engine; an app cannot add one.

### Design

**An engine value, not module functions.** `defineEngine({ kinds, presets, params })` returns a bound
`{ dt, defineCatalogue, createI18n }`, so every type below is parameterised by the app's kind map and param
vocabulary, with no declaration merging and no global. The backend calls the same function.

**Template parsing at the type level.** `ParseTemplate<T>` yields `readonly { name, kind }[]`; `dt` takes
`ValidTemplate<T, Engine>`, which is `T` when valid and a branded error string otherwise (the call fails with a readable
message such as `DuplicateParam<'count'>`, `UnknownParam<'cnt'>`, `ClashingKinds<'name'>`).

1. **Config is exactly the template's** (G1). `ConfigFor<T>` has one required entry per kind that appears in `T`, each
   keyed by exactly the names of that kind; `Exact<Expected, C>` maps any extra key to `never`. `{count:plural}` with no
   config, with `plural: { total: ... }`, or with an extra `number: { other: ... }` all fail to compile.
2. **Plural branches** (G2). `Branches` is `{ [K in Intl.LDMLPluralRule]?: Branch } & { other: Branch }`; a `Branch` is a
   string literal checked by `BranchOk<S>`: the only placeholder allowed is `{?}`, any other `{...}` fails. The
   formatter of the count is a `NumberOptions` or a preset name.
3. **Locale completeness** (G3). `tests/architecture/plural-categories.test.ts` reads
   `new Intl.PluralRules(locale, { type }).resolvedOptions().pluralCategories` for each locale the app registers and
   each plural message in that locale's catalogue (shared layer included), and asserts the branches equal that set plus
   `other`: `pl` must hold `one`, `few`, `many`, `other`, `en` `one`, `other`, and a branch the locale can never select
   is a failure too. Fixture: a planted `pl` message with only `one` and `other`.
4. **Params parity across locales** (G4). `defineCatalogue<Source>()` returns a typed builder whose message type per key is
   `Message & { readonly params: ParamsOf<Source[F][M]> }`; every non-source locale is declared with it, and equality
   is two-way (`[A] extends [B]` and `[B] extends [A]`), so a dropped, renamed or retyped argument fails typecheck in
   the file of the locale that drifted. Renaming `{count}` to `{total}` in `en` therefore breaks every other locale
   until it follows.
5. **`t` from the registered catalogue** (acceptance goal 5). `createI18n<AppCatalogue>()` (and `useT` from
   `intl-react`'s `createReactI18n<AppCatalogue>()`) types `MessageKey`, `ArgsOf<K>` and `ArgumentFreeKey` from the app's
   merged catalogue (`typeof web & typeof shared`, with `DisjointNamespaces` failing a collision). A wrong key or wrong
   args fails typecheck in the app; `@kit/i18n` has no `en` import.

**Param names** (owner points 1):
- A closed vocabulary: the app declares `defineParams(['count', 'name', 'position', 'date', 'price'] as const)`; a
  template name outside it fails (`UnknownParam<'cnt'>`). Adding a name is one reviewed line, which keeps `count`
  from drifting into `total` and `n`.
- Shape rule at the type level, per character: a name is lower camelCase letters only (`IsCamelCase<Name>`), so `{0}`,
  `{count2}`, `{Name}`, `{a_b}` fail. An architecture test (`message-param-names.test.ts`, AST over `dt(` calls and the
  vocabulary file) repeats the rule and bans positional and numbered names, because a type can be bypassed by `as`.
- A name used with two kinds, or bare and typed (`{name}` and `{name:number}`), is `ClashingKinds<'name'>`.
- The argument object is the flattened mapped type, so hover and completion show `{ count: number; name: string }`
  and `t('videos.views', { | })` offers `count`; no tuple or index form exists.
- Renaming in `en` fails every other locale (item 4 above).

**Formatters** (owner point 2). Reused from `@vp/intl`: the option types `NumberOptions` (a `Pick` of
`Intl.NumberFormatOptions`, `formatters/number.ts`), `DateOptions` (`formatters/date.ts`), `ListOptions`
(`formatters/list.ts`), `intl.format({ type, value, options })`, and the named domain formatters it already has
(`money`, `percent`, `compact`, `bytes`, `relative`, `duration`, `date-time`, `views`, `subscribers`, ...). New, in
`@kit/i18n`:
- A **kind** is `defineKind({ name, arg, options, render })`; the built-ins `number`, `date`, `list`, `plural`, `enum`
  are written with it, so an app registers `money` or `relative` the same way, with no engine edit (G7).
- **Presets**: `definePresets({ number: { currencyCompact: { default: {...}, pl: {...} } }, date: { relativeShort: ... } })`
  registered by the app through the `FormatPresets` token. A preset is typed by its kind's options, resolved along the
  locale chain (`pl-PL`, `pl`, then `default`), so one name has locale-specific options.
- A message references a preset by a typed name: `number: { price: 'currencyCompact' }`, or overrides:
  `number: { price: { preset: 'currencyCompact', maximumFractionDigits: 1 } }`. An override accepts only options of
  that kind's option type, an unknown preset name fails typecheck (`UnknownPreset<'curencyCompact'>`), and inline
  options remain allowed for one-offs.
- The same engine value runs on the backend for server-rendered text (78, 142): the presets and kinds are data the
  server app provides, and `@vp/intl` is universal.

### Type-level tests

`packages/platform/universal/i18n/src/__tests__/type-fixtures/` holds `expectTypeOf` specs and `// @ts-expect-error` cases, run
by the package's `typecheck`: missing plural config, extra config key, plural without `other`, `{x}` in a branch,
`{0}` / `{count2}` / `{Name}`, duplicate and clashing names, a name outside the vocabulary, an unknown preset, an
option invalid for its kind, a locale message whose params differ (renamed, dropped, retyped), a wrong `t` key and wrong
args against a registered catalogue, and the namespace collision. A second set uses the second-app fixture's kinds and
presets to prove the engine is open.

## Design: tokens, registries, providers, and a better package set

### Token and provider model (`@kit/di`)

- **Token**: `Token<T>` is today's `@vp/composition` shape (`{ name, _t? }`, resolution by identity) plus `token<T>(name)`,
  moved down to universal so a browser package can declare one.
- **Needs versus provides**: a platform package exports (a) the token it needs, (b) a typed `define*` helper for data
  (`defineErrorCodes({...} as const)`, `defineLocales`, `definePresets`, `defineKind`), (c) `provide*(value): Provider`.
  It exports no instance, runs nothing at import time and reads no global.
- **Registration**: once, at the app's composition root (server: `apps/server/*/src/composition/`; client: each app's
  `src/lib/app-providers.ts`). `createRegistry().provide(...)` returns an immutable registry; a library function takes the
  registry or the value it needs as a parameter (no service locator in a function body). `registry.get(token)` returns
  `Result<T, MissingProvider>`, never throws ([84](84-result-typed-error-handling-shared-domain-rules.md)). On the
  server the registry feeds `@kit/composition`'s `Container`; in the browser `@kit/di-react` (`RegistryProvider`,
  `useProvided`) puts it in context. A token with no sensible default is **required**: a missing provision is a startup
  error, never a silent English or `'taitube'` fallback.
- **Registries that hold data** (error codes, locales, token sets, metric groups, key namespaces, rule sets) are frozen
  values built by `define*`: open for extension because any app, or a second app, builds its own; closed for
  modification because no library edits a list.
- **Tests substitute providers** with `createRegistry().provide(Token, fake)`, no `vi.mock` of an import.

Tokens by package (each is documented in that package's `AGENTS.md`): `@kit/errors` `ErrorCodeRegistry`; `@kit/intl`
`LocaleRegistry`; `@kit/i18n` `Catalogues`, `FormatPresets`, `ParamVocabulary`; `@kit/pagination` `PaginationLimits`;
`@kit/permissions` `RuleSets`; `@kit/validation` (codes through the registry); `@kit/ui` `AppearanceStorage`,
`BrandMark`, `UiCopy` (no default); `@kit/query` `SessionConfig`, `FailureCopy` (no default); `@kit/web-telemetry`
`TelemetryConfig`; `@kit/config` `EnvSchema`; `@kit/keyspace` `KeyNamespace`; `@kit/observability` `MetricsConfig`,
`MetricGroup`; `@kit/dev-token` `DevTokenConfig`; `@kit/compose-autoscaler` `AutoscalerConfig`; `@kit/runtime`
`Clock`, `Random`, `EnvSource`, `Fetch`.

### Better seams: what changes beyond moving files

1. **`@kit/di`** (T1) holds tokens, registry and provider; `@kit/composition` builds the lifecycle `Container` on it.
2. **`@kit/runtime`** (T1, universal) declares the environment tokens (`Clock`, `Random`, `EnvSource`, `Fetch`,
   `CookieJar`) and ships the per-environment init as **subpath entries of one package**, not three packages:
   `@kit/runtime/node` (Node and Bun: both expose the same web-standard and `node:` APIs, and the worker rule bans
   `Bun.*`) and `@kit/runtime/browser`. A runtime-agnostic core never reads `process.env`, `Date.now()` or `fetch` itself; it
   asks a token, so the same package runs in the browser, Node and Bun, and a spec supplies a fake clock without timers.
3. **Ports separated from adapters** (conditional on the commit 1 scan showing no product type in the signature):
   the infrastructure ports in `@vp/core/ports` (`cache-client`, `job-queue`, `flow-producer`, `health-checkable`,
   `database-client`) move to `@kit/ports` (platform, server, T2), each with its **contract suite**; the product's own
   ports (`reaction-cache`, `live-gateway`, ...) stay in `@vp/core`. The in-memory reference implementations stay in
   `@vp/adapters` and run the same contract suite.
4. **Contract tests ship with the package** (goal 6): each generic package that defines a port or a registry exports a
   `./contract` entry, `runXContract(makeImpl)`, which another app runs against its own implementation (a cache, a
   keyspace, a rule set, a locale registry); vitest is a peer. `@kit/testing` holds the shared harness.
5. **Merge** `@kit/config` and the env helpers (one place for "read an env through a schema"); **split** `errors` and
   `intl` as the mapping shows. **No** package per environment (`bootstrap-server`, `bootstrap-client`): each deployable
   already has one composition root, and a wiring package would itself know the app (*Decisions*).

Dependency layering of the platform side (strictly down, same rule as `vp.layer`; every edge stays inside platform):

| Layer | Universal | Client | Server |
|---|---|---|---|
| P1, no platform dependency | `result`, `di`, `primitives`, `tsconfig` | | `concurrency`, `logger`, `object-storage`, `vite-preset`, `runtime` (universal) |
| P2 | `errors`, `pagination`, `intl`, `validation`, `permissions`, `design-tokens` | `security-headers` | `composition`, `keyspace`, `observability`, `testing`, `dev-token`, `compose-autoscaler`, `ports` |
| P3 | `i18n` | `ui`, `intl-react`, `di-react`, `web-telemetry` | `config` |
| P4 | | `components`, `forms`, `query` | |

### A package that stays stable: the rules

The platform packages are not updated regularly, only for features and fixes, so each is built to stay put:

1. **A small, explicit public API.** An `exports` map with `.` and, where meant, `./contract`; nothing else resolves, so no
   deep import. `pnpm gen:api` writes each package's surface (exported names with their types, through the TypeScript
   compiler API the architecture suite already builds) to `api/<name>.api.txt`; `--check` fails CI on a diff, so any
   change to the surface is a reviewed diff (api-extractor is the rejected alternative: a new tool and report format for
   what 150 lines of the existing compiler API do).
2. **Semver and deprecation.** `version` is real (`0.1.0` while the API settles, `1.0.0` when a second app has used it);
   each package has a `CHANGELOG.md`; a surface diff without a changelog entry and a version bump fails the PR check
   (`scripts/check-platform-changes.ts`, run against `origin/main`). A removal needs a prior `@deprecated` with a removal
   version and one release of overlap.
3. **Extend, never edit.** New behaviour arrives as a new token, a registry entry, a plugin (`defineKind`), or an option
   with a default that keeps the old behaviour; existing behaviour is changed only by a major bump.
4. **Maximum type safety**: strict generics, branded and opaque types where they prevent a mix-up (`Brand<T, 'UserId'>`
   in `@kit/primitives`), exhaustive discriminated unions ending in `assertNever`, `satisfies`-checked registries, no
   `any`, no type assertion except `as const`, no non-null `!`, no `@ts-ignore`; misuse is a compile error and every
   public generic has a type-level spec (`expectTypeOf`, `// @ts-expect-error`). `platform-type-strictness.test.ts` (AST)
   holds the bans with no exception list.
5. **Zero runtime dependencies**: a platform package's `dependencies` are other platform packages only; `zod`, `pino`,
   `@casl/ability`, React, OpenTelemetry and `prom-client` are `peerDependencies`. Side-effect free (`sideEffects: false`),
   tree-shakeable, **ESM only**: there is no CJS consumer, and a dual build is added when one exists.
6. **Contract tests** (above) are part of the surface: changing one is a surface change.

### Extractability check (CI)

`scripts/check-extractable.ts` (`pnpm check:extractable [<package>]`), for every package under `packages/platform/`:

1. computes its platform closure from the manifests, copies those packages (source, manifest, tsconfig, tests, README)
   to `mkdtemp()` outside the repository, with a generated `pnpm-workspace.yaml` that lists only the closure and nothing
   from the repo root;
2. `pnpm install --offline` against the local store (local-first: no network), then `tsc --noEmit` and `vitest run` there;
3. asserts that `realpath` of every resolved module is inside the temp directory, and that no source path leaves its
   package folder;
4. runs the **second dummy app** (`tests/fixtures/second-app/`, excluded from the workspace globs) against `pnpm pack`
   tarballs of those packages: it registers its own error codes, two other locales (one right to left), another cookie
   prefix, key namespace, metric prefix and dev-token issuer, builds a registry, and passes its own spec, which proves
   the packages work as installed npm packages and contain none of this product's values.

CI runs it as one job sharded per package (`extractable`), inside the budget formula in `testing.md` section 9.

### Enforcement (new `tests/architecture/` assertions, each with a planted fixture that fires, and a row in ARCHITECTURE.md section 6)

- `package-boundaries` (extended in `scripts/check-boundaries.ts`): a package takes its scope from its directory
  (`packages/platform/<tier>/<name>` is platform); **a platform package depends, peer-depends and dev-depends only on
  platform packages** (build tooling is platform too); the tier and layer rules are unchanged.
- `platform-no-app-data.test.ts`: in platform source, no string naming the product (`taitube`, `vp.`, `vp_`,
  `video-pipeline`, `vp-dev`), no env key of the app, no route, no import of an app-side package or an app (AST).
- `platform-no-copy.test.ts`: no platform package contains a translation catalogue, a `dt(` call or a user-facing English
  string (a string literal in JSX text or in a `label`, `title`, `aria-label`, `placeholder`, `message` property that is
  not a token, a key or an identifier) (AST over `.ts` and `.tsx`).
- `platform-no-deep-imports.test.ts`: no `@kit/<pkg>/src/...`, no import not listed in the target's `exports`, no relative
  path leaving a package root (closes the gap `packages/AGENTS.md` section 6 states).
- `platform-no-import-time-registration.test.ts`: a platform top level never calls `provide`, `register` or `define*`
  against shared state.
- `platform-manifest.test.ts`: `exports`, `types`, `sideEffects: false`, `version`, `CHANGELOG.md`, `README.md`,
  `AGENTS.md`, `api/<name>.api.txt`, own `tsconfig` extending `@kit/tsconfig` only; `dependencies` platform only.
- `platform-type-strictness.test.ts`, `plural-categories.test.ts`, `message-param-names.test.ts`,
  `translation-layers.test.ts` (a key in an app-shared catalogue needs a literal call site in two consumers, or is reachable
  from a registry two consumers import, an exceptions file lists the dynamic ones with a reason), `second-app` (via the
  extractable job), `package-map.test.ts` (`docs/package-map.md` equals what `pnpm gen:package-map` prints from the manifests).

**Rejected alternatives:** tokens inside `@vp/composition` (server only); one `@kit/config` object holding every setting
(app knowledge in one place, a dependency of everything); module-level `registerErrorCodes()` singletons (global state,
order dependent); a DI framework with decorators (`tsyringe`, Inversify: reflection, ADR-25, a runtime dependency);
per-app generated library code (one build per app); `bootstrap-server` / `bootstrap-client` packages (they would know the
app); a `vp.scope` manifest field alone (can disagree with the path); publishing to a registry now (below).

## Delivery

**One PR**, branch `ticket/170-platform-packages`, no stack. The work is ordered commits; each leaves `pnpm boundaries`,
`pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm test:architecture` green, so the branch bisects. **File moves are
kept in their own commits, apart from content edits**, so `git log --follow` and blame follow every file:

0. Re-measure: the survey table, the type-aware key-usage scan, the generic-port scan (`core/ports`), the `api-client`
   check; add `scripts/package-moves.json` (old export to new package) and `pnpm gen:package-map`. No moves.
1. `@kit/di` and `@kit/runtime` as new packages (under `packages/platform/universal/`); `@vp/composition` imports `Token`
   from `@kit/di`. `check-boundaries.ts` learns `packages/platform/<tier>/<name>` and the platform-never-depends-on-app
   rule (vacuously true, nothing is there yet).
2. **Path indirection** (content): configs and architecture tests that name `packages/<tier>/<pkg>` by literal path find
   packages through the package map instead, and `pnpm-workspace.yaml` gains `packages/platform/*/*`, so the move below
   breaks nothing.
3. **`git mv` of the 17 whole-move packages** into `packages/platform/<tier>/<name>`; renames only, 100% similarity.
4. **Scope rename** (content, by codemod): those 17 packages from `@vp/<name>` to `@kit/<name>` in manifests, imports,
   `vi.mock(import(...))`, `tsconfig` paths and references, Vite aliases, `knip.json`, `turbo.json`, workflow filters,
   `Makefile`, docs. `pnpm install` regenerates the lockfile.
5. **One pair of commits per split**, in this order: `errors` (18 importers, the widest edge), `intl`, `pagination`,
   `messages` (with the catalogue moves of *Translations*), `validation`, `permissions`, `domain`; then client `ui`,
   `queries`; then server `events`, `observability`, `storage`, `env-schema` into `config`, `testing`, `core`. For each:
   (i) `git mv` of the generic files into the new platform package and the app files into the new app package, with the
   importer rewrite by the symbol-level codemod (only import lines change, so rename detection holds), then (ii) the
   content commit that adds the token, `define*` and `provide*`, the registration in the apps, and the spec that swaps it.
6. The type-safe engine in `@kit/i18n` (kinds, presets, params, parity), with its type-level specs.
7. Manifests and surface: `exports`, peers, `version`, `CHANGELOG.md`, README, `AGENTS.md`, `api/*.api.txt`, contract
   suites, `pnpm gen:api`.
8. Architecture assertions with their fixtures, `check-extractable.ts`, the second-app fixture and the `extractable` job,
   the CI filters, `pnpm gen:package-map --check`.
9. Docs and skills (criterion 22), 48's header and note, the README row; then read every doc whole and grep the old
   names.

PR size is not a reason to split. Honestly, though, this redesign is large: about 45 packages, a new directory axis and
a type-level rewrite of the engine. If it proves unreviewable, the smallest safe split is **two PRs in one `gh stack`**:
(1) commits 0 to 4 and 8's boundary rule, the mechanical half (layout, scope, `@kit/di`, no behaviour change), and (2)
commits 5 to 9, the generalisation (splits, translations, types, extractability, docs). Splitting any finer would leave
main with half a registry.

### What happens to each reference

- **Import specifiers**: rewritten by `scripts/codemod/rewrite-specifiers.ts` on the TypeScript compiler API, driven by
  `package-moves.json` at **export** level, so `import { ErrorCodes, type Failure } from '@vp/errors'` becomes two
  imports (`@vp/error-codes`, `@kit/errors`); it covers `import`, `export ... from`, dynamic `import()` and
  `vi.mock(import(...))`. No `.js` extensions are added anywhere.
- **Workspaces and manifests**: `pnpm-workspace.yaml` globs `packages/platform/*/*`, `packages/*/*`, `apps/*/*`;
  `workspace:*` edges are rewritten with the names; `pnpm install` regenerates `pnpm-lock.yaml`.
- **tsconfig**: `tsconfig.repo.json` and `tsconfig.base.json` references and every package's `extends` follow the new
  paths; platform packages extend `@kit/tsconfig` only.
- **turbo, CI, knip, biome, Makefile, lefthook**: filters and paths updated (3 workflow files, 7 root configs named in
  the survey); the scripts that name `packages/<tier>` (28 files under `scripts/`) read the package map.
- **Dockerfiles**: the images copy the `packages/` tree and `pnpm deploy` selects by app name, so no path changes; the
  build is proven by `make smoke-offline`, and the images' size is compared before and after.
- **Docs**: 50 files under `docs/` and 38 under `packages/` name a package path; they are rewritten by the same codemod
  where the reference is a path, by hand where it is prose; `CLAUDE.md` symlinks are re-synced (`pnpm sync:claude`).

## Sequencing

This touches almost every package, so it conflicts with everything in flight. **Order: the open PRs first, then this
ticket, then 48.**

| In flight or next | Conflicts with | What the migration does |
|---|---|---|
| #329, [113](113-channel-comment-moderation.md) (628 files) | the `errors` split (10 new codes), the `messages` split (about 174 entries across `studio-*`, `watch`, `library`, `notifications`, `errors`, `ui`), the `permissions` split (`ability.ts`, `comment-moderation.ts`), the `events` split (`commentSlowMode`), `queries` | merges first; its codes, entries and key then go through the new registries (codes into `@vp/error-codes`, each file to the studio, web or app-shared catalogue per the table, the key into `@vp/events` over `KeyNamespace`). If it lands after this branch started, whoever merges second rebases, and 113 is not made to wait |
| #326, [136](136-frontend-ui-and-feel-overhaul-web-and-studio.md) slice a (1762 files) | the whole moves of `ui`, `design-tokens`, `queries`, `vite-preset`, `web-telemetry`, `observability`, `dev-token`, `security-headers` | merges first; its theme and cookie code is then the input of the `ui` seams |
| [129](129-multiple-accounts-and-channels.md) (may start soon) | `SessionConfig` (`vp.session`, per-tab identity in `queries`), `auth` and `shell` words, `permissions` subjects, new codes | start after this merges, so its codes, strings and rules are registrations from the first commit; if it must start earlier, it merges before this ticket starts |
| [138](138-type-aware-lint-backlog.md) (may start soon) | every moved and split file | land it before this ticket or after, never in parallel; it is mechanical and cheap to rebase on top of the codemod |
| [112](112-upload-screening.md), [140](140-watch-parties.md) and 141-143 | codes, messages, tokens in the same packages | none blocks; whatever merges first is carried by the codemod, and after this merges they follow `docs/standards/platform-packages.md` |
| [48](48-project-rebrand-cli-unification.md) | renames every `@vp/*` package, every Docker and CLI name | **this ticket first, 48 after, once**: platform packages are born `@kit/*` and never `@taitube/*`, and 48 then renames only the app side (`@vp/*` to `@taitube/*`), the apps, services, Docker and CLI, reusing `package-moves.json` and the codemod. Doing 48 first would rename the 32 platform packages twice. This PR therefore adds 170 to 48's *Blocked by* and trims its package list (the rename sweep covers the app side only) |

Start only when no other large front-end or backend ticket is in flight.

## Acceptance criteria

1. The survey and the mapping tables cover every package under `packages/*/*`, each verdict has a reason, and the extractability
   blockers carry evidence; commit 0 re-measures them and any change is shown in the PR.
2. `packages/platform/<tier>/<name>` holds the 32 platform packages and `pnpm boundaries` fails when a platform package
   depends, peer-depends or dev-depends on an app package (a fixture proves it); tier and layer rules still pass.
3. `docs/package-map.md` is generated from the manifests (`pnpm gen:package-map`) and `--check` fails CI when it drifts.
4. Each platform package has a self-contained manifest (`name`, `version`, `exports`, `types`, `sideEffects: false`,
   `peerDependencies` for what the host provides, platform dependencies only), its own tsconfig extending `@kit/tsconfig`
   only, a README and an `AGENTS.md` with install, consumed tokens, exposed registries and a usage example.
5. **Extractability**: `pnpm check:extractable` copies every platform package with its platform closure to a temporary
   directory outside the repository, installs offline, typechecks and tests there, and fails if anything resolves from the
   repository or a source path leaves its folder; CI runs it for every platform package.
6. **Second app**: `tests/fixtures/second-app/` consumes `pnpm pack` tarballs of the platform packages, registers
   different error codes, two other locales (one right to left), another cookie prefix, key namespace, metric prefix and
   dev-token issuer, and its own spec passes; none of this product's values appear in the extracted packages.
7. `@kit/i18n` contains no string, no locale data and no import of an error code; `@kit/ui`, `@kit/components`,
   `@kit/forms`, `@kit/intl-react` and `@kit/query` contain no user-facing copy and no English fallback: their words come
   through props or the `UiCopy` / `FailureCopy` tokens, and a missing provision is a compile error or a startup error.
8. `platform-no-copy.test.ts` fails the build if a platform package contains a translation string, a catalogue or
   user-facing copy; `platform-no-app-data.test.ts` fails it on a product name, env key, route or import of an app package.
9. The namespace assignment table is implemented: each of the 26 `en` files (and `pl`) lives in web, studio, or the app-shared
   package, none in a platform package; `translation-layers.test.ts` fails if a key sits in an app-shared catalogue without
   two consumers (web and studio, or a client and a server), and `messages-are-client-only.test.ts` is replaced by it.
10. Error codes are registered by the app (`defineErrorCodes` in `@vp/error-codes`), error copy is keyed by that registry
    and total over it (a code without words fails to compile), and no platform package lists a code.
11. Type safety of messages, in `@kit/i18n`, proved by type-level specs (`expectTypeOf`, `// @ts-expect-error`): (a) `dt`
    requires a config with exactly the placeholder names of each kind in the template, rejecting extra and missing keys;
    (b) a plural needs `other`, only valid CLDR categories, and `{?}` is the only placeholder in a branch; (c) every
    locale's message has the same `Params` as the source, so renaming a placeholder in `en` fails typecheck in every other
    locale; (d) `t` takes its key and args from the catalogue the app registered; (e) param names come from a closed
    vocabulary, are lower camelCase letters, and do not clash across kinds.
12. `plural-categories.test.ts` reads `Intl.PluralRules(locale).resolvedOptions().pluralCategories` for each registered
    locale and requires each plural message to hold exactly those categories plus `other`; `message-param-names.test.ts`
    bans positional and numbered names (fixtures fire).
13. Formatters: presets are registered through `FormatPresets` and resolved per locale along the chain; a message names a
    preset by a typed name, overrides only options valid for its kind (`NumberOptions`, `DateOptions`, `ListOptions` from
    `@kit/intl`), and an unknown preset fails typecheck; an app registers a new kind or preset with no edit to the engine;
    the backend uses the same engine.
14. Each platform package exports a small explicit API through its `exports` map; `pnpm gen:api --check` compares it to
    `api/<name>.api.txt`, and a surface change without a `CHANGELOG.md` entry and a version bump fails the PR check.
15. Platform source has no `any`, no type assertion except `as const`, no non-null `!`, no `@ts-ignore`
    (`platform-type-strictness.test.ts`, no exception list); every public generic has a type-level spec.
16. Platform packages have no runtime dependency other than platform packages; third-party libraries are peers; all are
    `sideEffects: false` and ESM only.
17. Each generic package that defines a port or registry exports a `./contract` suite, and the repository's own
    implementations (`@vp/adapters`, the in-memory doubles, the app registries) run it.
18. Every one of the 32 platform packages has a token or registry (where it holds data) with a spec that swaps it for a fake;
    `platform-no-import-time-registration.test.ts` and `platform-no-deep-imports.test.ts` pass with fixtures that fire.
19. The four deployables each build their registry in one composition module; no platform package reads `process.env`,
    a cookie name, a locale list or the clock on its own.
20. `pnpm boundaries`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`,
    `pnpm check:extractable` and `make smoke-offline` pass; the architecture suite and every CI job stay inside their budgets;
    the web bundle does not grow (the lazy locale chunk is kept); `@kit/di` and the generic packages pass under `vitest`
    and `bun test` (`@kit/di-react` and client packages under `vitest` alone).
21. No new runtime dependency (local-first); no `.js` extension on a relative import; no ticket-numbered comments; the
    file ceiling (400 lines, 10 KB) holds for every new file.
22. **Docs hardening**, so later work does it right by default: a new `docs/standards/platform-packages.md` holds the
    definition, the directory axis, tokens, `define*` / `provide*`, extension-only changes, semver and deprecation, the API
    snapshot, contract suites, extractability and the second-app proof; `packages/AGENTS.md` gets a "Platform or app"
    section, the new map and the recipe "Adding a package" asks first whether it is platform; section 6's deep-import gap is
    closed; `packages/universal/AGENTS.md`, `packages/client/AGENTS.md` and `packages/server/AGENTS.md` each carry the
    platform rule with this ticket's offenders as the worked example and list their platform members; `ARCHITECTURE.md`
    section 6 gets a row per new assertion and the invariants gain the platform rule; `docs/standards/testing.md`,
    `docs/standards/formatting-and-i18n.md` (the layers, the engine's type rules, the presets, no copy in platform packages),
    `docs/standards/error-handling.md` (the registry) and `docs/agents/making-changes.md` are rewritten in place;
    `@kit/i18n`'s `AGENTS.md` (successor of `messages`) carries the invariants of section 2 plus the new
    rules; SDD ADR-23 and ADR-25 are amended; the skills `hexagonal-port-adapter`, `codebase-design`, `pnpm-workspace`
    and `work-ticket` point to the standard and ask the platform question first; `CLAUDE.md` rules 3 and 13 gain a line each.
    Every doc is read whole afterwards and the old names are grepped.
23. Ticket [48](48-project-rebrand-cli-unification.md) is edited in this PR: 170 added to *Blocked by*, its package list
    trimmed to the app side; `python3 docs/tickets/gen-index.py` is re-run.

## Out of scope

- Renaming the app side to `@taitube/*` and the apps, services, Docker and CLI (48).
- Publishing to a registry, and the release tooling it needs (*Decisions*).
- Moving the app-side packages, or splitting `api-contracts`, `domain-rules`, `db`, `adapters` into reusable parts.
- Changing any user-visible behaviour or string, or adding a locale beyond the fixture's.
- Server-rendered email and Discord text (78, 142 and a later notification ticket); this ticket leaves the app-shared
  layer and the same engine for them.

## Testing plan

Per platform package: a spec that swaps its provider (`it.each` over the swapped values, one named registry helper per
suite, one spec file per source file), its type-level specs, and its contract suite. Cross-cutting: the
second-app fixture in the extractable job; the assertions listed under *Enforcement*, each with a planted fixture; the
existing `catalogue-parity`, `error-copy-coverage`, `error-vocabulary`, `frontend-vocabulary`, `package-boundaries`,
`test-correspondence`, `client-app-duplicates` and `single-locale-source` suites, updated to read each app's registered
values, never weakened.

## Verification

- `pnpm boundaries && pnpm typecheck && pnpm lint`, output pasted.
- `pnpm test && pnpm test:bun && pnpm test:architecture`, with the architecture timing against its budget.
- `pnpm check:extractable`, the per-package output, and the second app's spec output.
- `pnpm gen:api --check` and `pnpm gen:package-map --check` clean.
- `grep -rnE "taitube|['\"]vp[._-]|video-pipeline" packages/platform` returns nothing outside tests; the same for
  `grep -rn "@vp/" packages/platform` (no app edge).
- `git log --follow` on one moved file from each split shows its history; the rename similarity of the move commits.
- `make smoke-offline`; `pnpm why bullmq` from `apps/client/web` still returns nothing; web bundle sizes before and
  after, with the locale chunk still lazy; image sizes before and after.

## Decisions and open questions

For the owner, each with a recommendation:

1. **Folder layout.** Recommended: a second directory axis, `packages/platform/<tier>/*` beside `packages/<tier>/*`
   (only platform packages move). Alternatives: a `vp.scope` manifest field (nothing moves, but it can disagree with the
   path and the reuse story is a manifest scan); `packages/lib` and `packages/app` for all 45 (moves 15 packages for no gain).
2. **Scope and names for platform packages.** Recommended: a neutral scope, `@kit/*` as a placeholder (the owner picks the
   real one before commit 4), never `@vp` and never `@taitube`; this is why 48 follows this ticket. Alternative: keep `@vp`
   until 48 and rename once to `@taitube` (platform packages then carry the product's name, which defeats reuse).
3. **Publish or copy?** Recommended: copy-based reuse, proven by `pnpm pack` tarballs and the extractability job, versions
   real and `private: true` kept; no registry publish in this ticket (local-first, no release tooling to own yet), and
   changesets plus a private registry when a second repository actually consumes them. Alternative: publish to a private
   registry now (a release pipeline, tokens and a support promise for 32 packages before one consumer exists).
4. **Tokens.** Recommended: new `@kit/di` and `@kit/di-react`, `@kit/composition` on top of it. Rejected: tokens inside
   `@vp/composition` (server only).
5. **Per-environment init.** Recommended: `@kit/runtime` with `node` and `browser` subpath entries (Bun uses `node`), no
   `bootstrap-*` packages. Alternative: one init package per environment, wiring the default libraries; revisit when a second
   app repeats the same three registrations.
6. **Translation layering.** Recommended: engine `@kit/i18n` (no strings); `@vp/shared-messages` for strings shared by
   web and studio or with the backend (`auth`, `browse.untitled`, `videos.{views,visibility}`, `errorPage`, `ui`, `errors`);
   per-app catalogues; platform UI packages ship no words. Alternatives: one shared translations package for all (web
   and studio would ship each other's text); per-app only (the shared words written twice, and 78 and 142 a third time).
   If the owner prefers "a shared package only for truly cross-app strings, else none", the shared layer is exactly that.
7. **`api-extractor` or our own surface snapshot.** Recommended: our own, on the compiler API the architecture suite already
   uses (no new tool); `api-extractor` is the alternative if a second repository wants its report format.
8. **Generic ports** (`@kit/ports`). Recommended: move the infrastructure ports only if commit 0 finds no product type in
   their signatures; otherwise they stay in `@vp/core` and the contract suites live beside them.
9. **Packages left app-scoped**: `permissions-react`, `api-client`, `web-testing`, `workbench`, `api-contracts`, `domain`,
   `domain-rules`, `core` (rest), `db`, `adapters`, `job-contracts`, `ffmpeg`, `whisper`, `lighthouse`, `stack`,
   `upload-client`, `gen-video`. Recommended: leave; each is the product's contract or runtime. `permissions-react` and
   `api-client` move in commit 0 if the scan shows they depend on the engine types only.
10. **Is one PR too big?** Honestly, yes it may be. The smallest safe split is two PRs in one stack (the mechanical
    layout and `@kit/di` first, the generalisation second); finer would leave main with half a registry.
11. **Timing.** Recommended: after #329 and #326 merge, before 48, with 129 and 138 held until it lands or merged first.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
