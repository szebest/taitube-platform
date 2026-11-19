# Package map

Every workspace package and app, generated from the manifests by `pnpm gen:package-map`: edit a
`package.json`, never this file, and `pnpm gen:package-map --check` fails CI when the two drift. The
scope (platform or app) and the tier are the directory and the layer is `vp.layer`
([packages/AGENTS.md](../packages/AGENTS.md)); where each package's exports are headed is
[scripts/package-moves.json](../scripts/package-moves.json).

| Package | Directory | Scope | Tier | Layer | Depends on | Dev-depends on |
|---|---|---|---|---|---|---|
| `@kit/appearance` | `packages/platform/universal/appearance` | platform | universal | T0 | - | `@kit/testing`, `@kit/tsconfig` |
| `@kit/primitives` | `packages/platform/universal/primitives` | platform | universal | T0 | - | `@kit/testing`, `@kit/tsconfig` |
| `@kit/concurrency` | `packages/platform/server/concurrency` | platform | server | T1 | - | `@kit/testing`, `@kit/tsconfig` |
| `@kit/keyspace` | `packages/platform/server/keyspace` | platform | server | T1 | - | `@kit/testing`, `@kit/tsconfig` |
| `@kit/logger` | `packages/platform/server/logger` | platform | server | T1 | - | `@kit/testing`, `@kit/tsconfig` |
| `@kit/object-storage` | `packages/platform/server/object-storage` | platform | server | T1 | - | `@kit/testing`, `@kit/tsconfig` |
| `@kit/vite-preset` | `packages/platform/server/vite-preset` | platform | server | T1 | - | `@kit/testing`, `@kit/tsconfig` |
| `@kit/machine` | `packages/platform/universal/machine` | platform | universal | T1 | - | `@kit/tsconfig` |
| `@kit/result` | `packages/platform/universal/result` | platform | universal | T1 | - | `@kit/tsconfig` |
| `@kit/tsconfig` | `packages/platform/universal/tsconfig` | platform | universal | T1 | - | - |
| `@vp/storage` | `packages/server/storage` | app | server | T1 | - | `@kit/testing`, `@kit/tsconfig`, `@vp/testing-fixtures` |
| `@vp/domain` | `packages/universal/domain` | app | universal | T1 | `@kit/appearance`, `@kit/primitives` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/security-headers` | `packages/platform/client/security-headers` | platform | client | T2 | `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/compose-autoscaler` | `packages/platform/server/compose-autoscaler` | platform | server | T2 | `@kit/logger` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/dev-token` | `packages/platform/server/dev-token` | platform | server | T2 | `@kit/logger` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/observability` | `packages/platform/server/observability` | platform | server | T2 | `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/testing` | `packages/platform/server/testing` | platform | server | T2 | `@kit/result` | `@kit/tsconfig` |
| `@kit/di` | `packages/platform/universal/di` | platform | universal | T2 | `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/intl` | `packages/platform/universal/intl` | platform | universal | T2 | `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/gen-video` | `packages/server/gen-video` | app | server | T2 | `@kit/logger` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/job-contracts` | `packages/server/job-contracts` | app | server | T2 | `@vp/domain` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/lighthouse` | `packages/server/lighthouse` | app | server | T2 | `@kit/primitives`, `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/stack` | `packages/server/stack` | app | server | T2 | `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/testing-fixtures` | `packages/server/testing-fixtures` | app | server | T2 | - | `@kit/testing`, `@kit/tsconfig` |
| `@kit/web-testing` | `packages/platform/client/web-testing` | platform | client | T3 | - | `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset` |
| `@kit/composition` | `packages/platform/server/composition` | platform | server | T3 | `@kit/di`, `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/errors` | `packages/platform/universal/errors` | platform | universal | T3 | `@kit/di` | `@kit/result`, `@kit/testing`, `@kit/tsconfig` |
| `@kit/i18n` | `packages/platform/universal/i18n` | platform | universal | T3 | `@kit/di`, `@kit/intl`, `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/runtime` | `packages/platform/universal/runtime` | platform | universal | T3 | `@kit/di` | `@kit/result`, `@kit/testing`, `@kit/tsconfig` |
| `@vp/dev-identity` | `packages/server/dev-identity` | app | server | T3 | `@kit/dev-token` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/pipeline-metrics` | `packages/server/pipeline-metrics` | app | server | T3 | `@kit/observability` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/intl-formats` | `packages/universal/intl-formats` | app | universal | T3 | `@kit/intl` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/config` | `packages/platform/server/config` | platform | server | T4 | `@kit/composition`, `@kit/logger`, `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/pagination` | `packages/platform/universal/pagination` | platform | universal | T4 | `@kit/errors`, `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/validation` | `packages/platform/universal/validation` | platform | universal | T4 | `@kit/errors` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/design-tokens` | `packages/platform/universal/design-tokens` | platform | universal | T5 | `@kit/appearance`, `@kit/errors`, `@kit/result` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/errors` | `packages/universal/errors` | app | universal | T5 | `@kit/errors`, `@kit/intl`, `@kit/pagination` | `@kit/testing`, `@kit/tsconfig` |
| `@kit/ui` | `packages/platform/client/ui` | platform | client | T6 | `@kit/appearance`, `@kit/design-tokens`, `@kit/errors`, `@kit/result` | `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset`, `@kit/web-testing` |
| `@vp/env-schema` | `packages/server/env-schema` | app | server | T6 | `@kit/observability`, `@kit/pagination`, `@kit/primitives`, `@kit/result`, `@vp/domain` | `@kit/config`, `@kit/testing`, `@kit/tsconfig`, `@vp/testing-fixtures` |
| `@vp/events` | `packages/server/events` | app | server | T6 | `@kit/keyspace`, `@kit/result`, `@vp/errors` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/ffmpeg` | `packages/server/ffmpeg` | app | server | T6 | `@kit/errors`, `@kit/primitives`, `@kit/result`, `@vp/domain`, `@vp/errors`, `@vp/job-contracts`, `@vp/storage` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/whisper` | `packages/server/whisper` | app | server | T6 | `@kit/result`, `@vp/domain`, `@vp/errors` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/messages` | `packages/universal/messages` | app | universal | T6 | `@kit/intl`, `@kit/result`, `@vp/errors` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/permissions` | `packages/universal/permissions` | app | universal | T6 | `@kit/errors`, `@vp/domain`, `@vp/errors` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/validation` | `packages/universal/validation` | app | universal | T6 | `@kit/errors`, `@kit/result`, `@kit/validation`, `@vp/errors` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/permissions-react` | `packages/client/permissions-react` | app | client | T7 | `@kit/result`, `@vp/permissions` | `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset` |
| `@kit/components` | `packages/platform/client/components` | platform | client | T7 | `@kit/design-tokens`, `@kit/ui` | `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset`, `@kit/web-testing` |
| `@kit/forms` | `packages/platform/client/forms` | platform | client | T7 | `@kit/errors`, `@kit/result`, `@kit/ui` | `@kit/testing`, `@kit/tsconfig`, `@kit/validation`, `@kit/vite-preset`, `@kit/web-testing` |
| `@kit/intl-react` | `packages/platform/client/intl-react` | platform | client | T7 | `@kit/intl`, `@kit/result`, `@kit/runtime` | `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset` |
| `@kit/web-telemetry` | `packages/platform/client/web-telemetry` | platform | client | T7 | `@kit/result` | `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset`, `@kit/web-testing` |
| `@vp/core` | `packages/server/core` | app | server | T7 | `@kit/errors`, `@kit/result`, `@vp/domain`, `@vp/errors`, `@vp/permissions` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/db` | `packages/server/db` | app | server | T7 | `@kit/result`, `@vp/domain`, `@vp/job-contracts`, `@vp/storage`, `@vp/validation` | `@kit/testing`, `@kit/tsconfig`, `@vp/testing-fixtures` |
| `@vp/deploy` | `packages/server/deploy` | app | server | T7 | `@kit/result`, `@vp/env-schema`, `@vp/job-contracts` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/api-contracts` | `packages/universal/api-contracts` | app | universal | T7 | `@kit/appearance`, `@kit/errors`, `@kit/pagination`, `@kit/primitives`, `@kit/result`, `@vp/domain`, `@vp/errors`, `@vp/permissions`, `@vp/validation` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/domain-rules` | `packages/universal/domain-rules` | app | universal | T7 | `@kit/appearance`, `@kit/errors`, `@kit/machine`, `@kit/primitives`, `@kit/result`, `@vp/domain`, `@vp/errors`, `@vp/permissions`, `@vp/validation` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/api-client` | `packages/client/api-client` | app | client | T8 | `@vp/api-contracts` | `@kit/result`, `@kit/testing`, `@kit/tsconfig`, `@vp/domain-rules`, `@vp/validation` |
| `@vp/adapters` | `packages/server/adapters` | app | server | T8 | `@kit/composition`, `@kit/concurrency`, `@kit/di`, `@kit/errors`, `@kit/object-storage`, `@kit/primitives`, `@kit/result`, `@vp/core`, `@vp/db`, `@vp/dev-identity`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/job-contracts`, `@vp/permissions`, `@vp/pipeline-metrics`, `@vp/validation` | `@kit/testing`, `@kit/tsconfig`, `@vp/testing-fixtures` |
| `@vp/fingerprint` | `packages/server/fingerprint` | app | server | T8 | `@kit/errors`, `@kit/result`, `@vp/core`, `@vp/domain`, `@vp/errors`, `@vp/ffmpeg` | `@kit/testing`, `@kit/tsconfig` |
| `@vp/api` | `apps/server/api` | app | server | T9 | `@kit/composition`, `@kit/concurrency`, `@kit/config`, `@kit/errors`, `@kit/intl`, `@kit/keyspace`, `@kit/logger`, `@kit/object-storage`, `@kit/observability`, `@kit/pagination`, `@kit/primitives`, `@kit/result`, `@vp/adapters`, `@vp/api-contracts`, `@vp/core`, `@vp/db`, `@vp/dev-identity`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/job-contracts`, `@vp/permissions`, `@vp/pipeline-metrics`, `@vp/storage`, `@vp/validation`, `@vp/whisper` | `@kit/testing`, `@kit/tsconfig`, `@vp/testing-fixtures` |
| `@vp/worker` | `apps/server/worker` | app | server | T9 | `@kit/composition`, `@kit/config`, `@kit/errors`, `@kit/logger`, `@kit/object-storage`, `@kit/observability`, `@kit/primitives`, `@kit/result`, `@vp/adapters`, `@vp/api-contracts`, `@vp/core`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/ffmpeg`, `@vp/fingerprint`, `@vp/job-contracts`, `@vp/pipeline-metrics`, `@vp/storage`, `@vp/validation`, `@vp/whisper` | `@kit/testing`, `@kit/tsconfig`, `@vp/testing-fixtures` |
| `@vp/queries` | `packages/client/queries` | app | client | T9 | `@kit/components`, `@kit/errors`, `@kit/intl`, `@kit/intl-react`, `@kit/result`, `@kit/security-headers`, `@kit/ui`, `@vp/api-client`, `@vp/api-contracts`, `@vp/domain`, `@vp/errors`, `@vp/messages`, `@vp/permissions`, `@vp/permissions-react` | `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset`, `@kit/web-testing`, `@vp/web-testing` |
| `@vp/web-testing` | `packages/client/web-testing` | app | client | T9 | `@kit/web-testing`, `@vp/api-client`, `@vp/api-contracts`, `@vp/errors` | `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset` |
| `@vp/studio` | `apps/client/studio` | app | client | T10 | `@kit/components`, `@kit/design-tokens`, `@kit/forms`, `@kit/intl`, `@kit/intl-react`, `@kit/result`, `@kit/security-headers`, `@kit/ui`, `@kit/web-telemetry`, `@vp/api-client`, `@vp/api-contracts`, `@vp/domain`, `@vp/domain-rules`, `@vp/errors`, `@vp/intl-formats`, `@vp/permissions`, `@vp/permissions-react`, `@vp/queries`, `@vp/validation` | `@kit/primitives`, `@kit/testing`, `@kit/tsconfig`, `@kit/vite-preset`, `@kit/web-testing`, `@vp/web-testing` |
| `@vp/web` | `apps/client/web` | app | client | T10 | `@kit/appearance`, `@kit/components`, `@kit/design-tokens`, `@kit/forms`, `@kit/intl`, `@kit/intl-react`, `@kit/primitives`, `@kit/result`, `@kit/security-headers`, `@kit/ui`, `@kit/web-telemetry`, `@vp/api-client`, `@vp/api-contracts`, `@vp/domain`, `@vp/domain-rules`, `@vp/intl-formats`, `@vp/messages`, `@vp/permissions`, `@vp/permissions-react`, `@vp/queries`, `@vp/validation` | `@kit/tsconfig`, `@kit/vite-preset`, `@kit/web-testing`, `@vp/errors`, `@vp/web-testing` |
| `@vp/workbench` | `packages/client/workbench` | app | client | T10 | - | `@kit/appearance`, `@kit/components`, `@kit/design-tokens`, `@kit/intl`, `@kit/intl-react`, `@kit/result`, `@kit/testing`, `@kit/tsconfig`, `@kit/ui`, `@kit/vite-preset`, `@kit/web-testing`, `@vp/api-client`, `@vp/api-contracts`, `@vp/messages`, `@vp/queries`, `@vp/web-testing` |
| `@vp/upload-client` | `packages/server/upload-client` | app | server | T10 | `@kit/logger`, `@kit/result` | `@kit/testing`, `@kit/tsconfig`, `@vp/adapters`, `@vp/api`, `@vp/dev-identity`, `@vp/env-schema`, `@vp/testing-fixtures` |
| `@vp/demo` | `packages/server/demo` | app | server | T11 | `@kit/errors`, `@kit/result`, `@vp/db`, `@vp/dev-identity`, `@vp/domain`, `@vp/env-schema`, `@vp/errors`, `@vp/upload-client` | `@kit/testing`, `@kit/tsconfig`, `@vp/testing-fixtures` |
