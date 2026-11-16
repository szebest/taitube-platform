# Package map

Every workspace package and app, generated from the manifests by `pnpm gen:package-map`: edit a
`package.json`, never this file, and `pnpm gen:package-map --check` fails CI when the two drift. The
scope (platform or app) and the tier are the directory and the layer is `vp.layer`
([packages/AGENTS.md](../packages/AGENTS.md)); where each package's exports are headed is
[scripts/package-moves.json](../scripts/package-moves.json).

| Package | Directory | Scope | Tier | Layer | Depends on | Dev-depends on |
|---|---|---|---|---|---|---|
| `@vp/concurrency` | `packages/server/concurrency` | app | server | T1 | - | `@vp/testing`, `@vp/tsconfig` |
| `@vp/logger` | `packages/server/logger` | app | server | T1 | - | `@vp/testing`, `@vp/tsconfig` |
| `@vp/storage` | `packages/server/storage` | app | server | T1 | - | `@vp/testing`, `@vp/tsconfig` |
| `@vp/vite-preset` | `packages/server/vite-preset` | app | server | T1 | - | `@vp/testing`, `@vp/tsconfig` |
| `@vp/domain` | `packages/universal/domain` | app | universal | T1 | - | `@vp/testing`, `@vp/tsconfig` |
| `@vp/errors` | `packages/universal/errors` | app | universal | T1 | - | `@vp/testing`, `@vp/tsconfig` |
| `@vp/machine` | `packages/universal/machine` | app | universal | T1 | - | `@vp/tsconfig` |
| `@vp/result` | `packages/universal/result` | app | universal | T1 | - | `@vp/tsconfig` |
| `@vp/tsconfig` | `packages/universal/tsconfig` | app | universal | T1 | - | - |
| `@vp/security-headers` | `packages/client/security-headers` | app | client | T2 | `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@kit/di` | `packages/platform/universal/di` | platform | universal | T2 | `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/compose-autoscaler` | `packages/server/compose-autoscaler` | app | server | T2 | `@vp/logger` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/dev-token` | `packages/server/dev-token` | app | server | T2 | `@vp/logger` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/events` | `packages/server/events` | app | server | T2 | `@vp/errors`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/gen-video` | `packages/server/gen-video` | app | server | T2 | `@vp/logger` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/job-contracts` | `packages/server/job-contracts` | app | server | T2 | `@vp/domain` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/lighthouse` | `packages/server/lighthouse` | app | server | T2 | `@vp/domain`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/observability` | `packages/server/observability` | app | server | T2 | `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/stack` | `packages/server/stack` | app | server | T2 | `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/testing` | `packages/server/testing` | app | server | T2 | `@vp/result` | `@vp/tsconfig` |
| `@vp/whisper` | `packages/server/whisper` | app | server | T2 | `@vp/domain`, `@vp/errors`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/design-tokens` | `packages/universal/design-tokens` | app | universal | T2 | `@vp/domain`, `@vp/errors`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/intl` | `packages/universal/intl` | app | universal | T2 | `@vp/errors`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/pagination` | `packages/universal/pagination` | app | universal | T2 | `@vp/errors`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/permissions` | `packages/universal/permissions` | app | universal | T2 | `@vp/domain`, `@vp/errors` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/validation` | `packages/universal/validation` | app | universal | T2 | `@vp/errors`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/permissions-react` | `packages/client/permissions-react` | app | client | T3 | `@vp/permissions`, `@vp/result` | `@vp/testing`, `@vp/tsconfig`, `@vp/vite-preset` |
| `@vp/ui` | `packages/client/ui` | app | client | T3 | `@vp/design-tokens`, `@vp/domain`, `@vp/errors`, `@vp/result` | `@vp/testing`, `@vp/tsconfig`, `@vp/vite-preset`, `@vp/web-testing` |
| `@kit/i18n` | `packages/platform/universal/i18n` | platform | universal | T3 | `@kit/di`, `@vp/intl`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@kit/runtime` | `packages/platform/universal/runtime` | platform | universal | T3 | `@kit/di` | `@vp/result`, `@vp/testing`, `@vp/tsconfig` |
| `@vp/composition` | `packages/server/composition` | app | server | T3 | `@kit/di`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/core` | `packages/server/core` | app | server | T3 | `@vp/domain`, `@vp/errors`, `@vp/permissions`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/db` | `packages/server/db` | app | server | T3 | `@vp/domain`, `@vp/job-contracts`, `@vp/result`, `@vp/storage`, `@vp/validation` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/env-schema` | `packages/server/env-schema` | app | server | T3 | `@vp/domain`, `@vp/observability`, `@vp/pagination`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/ffmpeg` | `packages/server/ffmpeg` | app | server | T3 | `@vp/domain`, `@vp/errors`, `@vp/job-contracts`, `@vp/result`, `@vp/storage` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/api-contracts` | `packages/universal/api-contracts` | app | universal | T3 | `@vp/domain`, `@vp/errors`, `@vp/pagination`, `@vp/permissions`, `@vp/result`, `@vp/validation` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/domain-rules` | `packages/universal/domain-rules` | app | universal | T3 | `@vp/domain`, `@vp/errors`, `@vp/machine`, `@vp/permissions`, `@vp/result`, `@vp/validation` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/messages` | `packages/universal/messages` | app | universal | T3 | `@vp/errors`, `@vp/intl`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/api-client` | `packages/client/api-client` | app | client | T4 | `@vp/api-contracts` | `@vp/domain-rules`, `@vp/result`, `@vp/testing`, `@vp/tsconfig`, `@vp/validation` |
| `@vp/components` | `packages/client/components` | app | client | T4 | `@vp/design-tokens`, `@vp/ui` | `@vp/testing`, `@vp/tsconfig`, `@vp/vite-preset`, `@vp/web-testing` |
| `@vp/forms` | `packages/client/forms` | app | client | T4 | `@vp/errors`, `@vp/result`, `@vp/ui` | `@vp/testing`, `@vp/tsconfig`, `@vp/validation`, `@vp/vite-preset`, `@vp/web-testing` |
| `@vp/intl-react` | `packages/client/intl-react` | app | client | T4 | `@vp/intl`, `@vp/messages`, `@vp/result` | `@vp/testing`, `@vp/tsconfig`, `@vp/vite-preset` |
| `@vp/web-telemetry` | `packages/client/web-telemetry` | app | client | T4 | `@vp/api-contracts`, `@vp/result` | `@vp/testing`, `@vp/tsconfig`, `@vp/vite-preset`, `@vp/web-testing` |
| `@vp/adapters` | `packages/server/adapters` | app | server | T4 | `@kit/di`, `@vp/composition`, `@vp/concurrency`, `@vp/core`, `@vp/db`, `@vp/dev-token`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/job-contracts`, `@vp/observability`, `@vp/permissions`, `@vp/result`, `@vp/storage`, `@vp/validation` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/config` | `packages/server/config` | app | server | T4 | `@vp/composition`, `@vp/env-schema`, `@vp/logger`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/deploy` | `packages/server/deploy` | app | server | T4 | `@vp/env-schema`, `@vp/job-contracts`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/fingerprint` | `packages/server/fingerprint` | app | server | T4 | `@vp/core`, `@vp/domain`, `@vp/errors`, `@vp/ffmpeg`, `@vp/result` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/queries` | `packages/client/queries` | app | client | T5 | `@vp/api-client`, `@vp/api-contracts`, `@vp/components`, `@vp/domain`, `@vp/errors`, `@vp/intl`, `@vp/intl-react`, `@vp/messages`, `@vp/permissions`, `@vp/permissions-react`, `@vp/result`, `@vp/security-headers`, `@vp/ui` | `@vp/testing`, `@vp/tsconfig`, `@vp/vite-preset`, `@vp/web-testing` |
| `@vp/web-testing` | `packages/client/web-testing` | app | client | T5 | `@vp/api-client`, `@vp/api-contracts`, `@vp/errors` | `@vp/testing`, `@vp/tsconfig`, `@vp/vite-preset` |
| `@vp/studio` | `apps/client/studio` | app | client | T6 | `@vp/api-client`, `@vp/api-contracts`, `@vp/components`, `@vp/design-tokens`, `@vp/domain`, `@vp/domain-rules`, `@vp/errors`, `@vp/forms`, `@vp/intl`, `@vp/intl-react`, `@vp/permissions`, `@vp/permissions-react`, `@vp/queries`, `@vp/result`, `@vp/security-headers`, `@vp/ui`, `@vp/validation`, `@vp/web-telemetry` | `@vp/testing`, `@vp/tsconfig`, `@vp/vite-preset`, `@vp/web-testing` |
| `@vp/web` | `apps/client/web` | app | client | T6 | `@vp/api-client`, `@vp/api-contracts`, `@vp/components`, `@vp/design-tokens`, `@vp/domain`, `@vp/domain-rules`, `@vp/forms`, `@vp/intl`, `@vp/intl-react`, `@vp/messages`, `@vp/permissions`, `@vp/permissions-react`, `@vp/queries`, `@vp/result`, `@vp/security-headers`, `@vp/ui`, `@vp/validation`, `@vp/web-telemetry` | `@vp/errors`, `@vp/tsconfig`, `@vp/vite-preset`, `@vp/web-testing` |
| `@vp/api` | `apps/server/api` | app | server | T6 | `@vp/adapters`, `@vp/api-contracts`, `@vp/composition`, `@vp/concurrency`, `@vp/config`, `@vp/core`, `@vp/db`, `@vp/dev-token`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/intl`, `@vp/job-contracts`, `@vp/logger`, `@vp/observability`, `@vp/pagination`, `@vp/permissions`, `@vp/result`, `@vp/storage`, `@vp/validation`, `@vp/whisper` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/worker` | `apps/server/worker` | app | server | T6 | `@vp/adapters`, `@vp/api-contracts`, `@vp/composition`, `@vp/config`, `@vp/core`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/ffmpeg`, `@vp/fingerprint`, `@vp/job-contracts`, `@vp/logger`, `@vp/observability`, `@vp/result`, `@vp/storage`, `@vp/validation`, `@vp/whisper` | `@vp/testing`, `@vp/tsconfig` |
| `@vp/workbench` | `packages/client/workbench` | app | client | T7 | - | `@vp/api-client`, `@vp/api-contracts`, `@vp/components`, `@vp/design-tokens`, `@vp/intl`, `@vp/intl-react`, `@vp/messages`, `@vp/queries`, `@vp/result`, `@vp/testing`, `@vp/tsconfig`, `@vp/ui`, `@vp/vite-preset`, `@vp/web-testing` |
| `@vp/upload-client` | `packages/server/upload-client` | app | server | T7 | `@vp/logger`, `@vp/result` | `@vp/adapters`, `@vp/api`, `@vp/dev-token`, `@vp/env-schema`, `@vp/testing`, `@vp/tsconfig` |
| `@vp/demo` | `packages/server/demo` | app | server | T8 | `@vp/db`, `@vp/dev-token`, `@vp/domain`, `@vp/env-schema`, `@vp/errors`, `@vp/result`, `@vp/upload-client` | `@vp/testing`, `@vp/tsconfig` |
