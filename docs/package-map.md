# Package map

Every workspace package and app, generated from the manifests by `pnpm gen:package-map`: edit a
`package.json`, never this file, and `pnpm gen:package-map --check` fails CI when the two drift. The
scope (platform or app) and the tier are the directory and the layer is `vp.layer`
([packages/AGENTS.md](../packages/AGENTS.md)); where each package's exports are headed is
[scripts/package-moves.json](../scripts/package-moves.json).

| Package | Directory | Scope | Tier | Layer | Depends on | Dev-depends on |
|---|---|---|---|---|---|---|
| `@kit/primitives` | `packages/platform/universal/primitives` | platform | universal | T0 | - | `@kit/tsconfig`, `@vp/testing` |
| `@kit/concurrency` | `packages/platform/server/concurrency` | platform | server | T1 | - | `@kit/tsconfig`, `@vp/testing` |
| `@kit/logger` | `packages/platform/server/logger` | platform | server | T1 | - | `@kit/tsconfig`, `@vp/testing` |
| `@kit/vite-preset` | `packages/platform/server/vite-preset` | platform | server | T1 | - | `@kit/tsconfig`, `@vp/testing` |
| `@kit/machine` | `packages/platform/universal/machine` | platform | universal | T1 | - | `@kit/tsconfig` |
| `@kit/result` | `packages/platform/universal/result` | platform | universal | T1 | - | `@kit/tsconfig` |
| `@kit/tsconfig` | `packages/platform/universal/tsconfig` | platform | universal | T1 | - | - |
| `@vp/storage` | `packages/server/storage` | app | server | T1 | - | `@kit/tsconfig`, `@vp/testing` |
| `@vp/domain` | `packages/universal/domain` | app | universal | T1 | `@kit/primitives` | `@kit/tsconfig`, `@vp/testing` |
| `@kit/security-headers` | `packages/platform/client/security-headers` | platform | client | T2 | `@kit/result` | `@kit/tsconfig`, `@vp/testing` |
| `@kit/compose-autoscaler` | `packages/platform/server/compose-autoscaler` | platform | server | T2 | `@kit/logger` | `@kit/tsconfig`, `@vp/testing` |
| `@kit/dev-token` | `packages/platform/server/dev-token` | platform | server | T2 | `@kit/logger` | `@kit/tsconfig`, `@vp/testing` |
| `@kit/di` | `packages/platform/universal/di` | platform | universal | T2 | `@kit/result` | `@kit/tsconfig`, `@vp/testing` |
| `@kit/intl` | `packages/platform/universal/intl` | platform | universal | T2 | `@kit/result` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/gen-video` | `packages/server/gen-video` | app | server | T2 | `@kit/logger` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/job-contracts` | `packages/server/job-contracts` | app | server | T2 | `@vp/domain` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/lighthouse` | `packages/server/lighthouse` | app | server | T2 | `@kit/primitives`, `@kit/result` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/observability` | `packages/server/observability` | app | server | T2 | `@kit/result` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/stack` | `packages/server/stack` | app | server | T2 | `@kit/result` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/testing` | `packages/server/testing` | app | server | T2 | `@kit/result` | `@kit/tsconfig` |
| `@kit/composition` | `packages/platform/server/composition` | platform | server | T3 | `@kit/di`, `@kit/result` | `@kit/tsconfig`, `@vp/testing` |
| `@kit/i18n` | `packages/platform/universal/i18n` | platform | universal | T3 | `@kit/di`, `@kit/intl`, `@kit/result` | `@kit/tsconfig`, `@vp/testing` |
| `@kit/runtime` | `packages/platform/universal/runtime` | platform | universal | T3 | `@kit/di` | `@kit/result`, `@kit/tsconfig`, `@vp/testing` |
| `@vp/dev-identity` | `packages/server/dev-identity` | app | server | T3 | `@kit/dev-token` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/intl-formats` | `packages/universal/intl-formats` | app | universal | T3 | `@kit/intl` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/errors` | `packages/universal/errors` | app | universal | T4 | `@kit/di` | `@kit/result`, `@kit/tsconfig`, `@vp/testing` |
| `@kit/design-tokens` | `packages/platform/universal/design-tokens` | platform | universal | T5 | `@kit/result`, `@vp/domain`, `@vp/errors` | `@kit/tsconfig`, `@vp/testing` |
| `@kit/pagination` | `packages/platform/universal/pagination` | platform | universal | T5 | `@kit/result`, `@vp/errors` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/events` | `packages/server/events` | app | server | T5 | `@kit/result`, `@vp/errors` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/ffmpeg` | `packages/server/ffmpeg` | app | server | T5 | `@kit/primitives`, `@kit/result`, `@vp/domain`, `@vp/errors`, `@vp/job-contracts`, `@vp/storage` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/whisper` | `packages/server/whisper` | app | server | T5 | `@kit/result`, `@vp/domain`, `@vp/errors` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/messages` | `packages/universal/messages` | app | universal | T5 | `@kit/intl`, `@kit/result`, `@vp/errors` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/permissions` | `packages/universal/permissions` | app | universal | T5 | `@vp/domain`, `@vp/errors` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/validation` | `packages/universal/validation` | app | universal | T5 | `@kit/result`, `@vp/errors` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/permissions-react` | `packages/client/permissions-react` | app | client | T6 | `@kit/result`, `@vp/permissions` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing` |
| `@kit/intl-react` | `packages/platform/client/intl-react` | platform | client | T6 | `@kit/intl`, `@kit/result`, `@vp/messages` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing` |
| `@kit/ui` | `packages/platform/client/ui` | platform | client | T6 | `@kit/design-tokens`, `@kit/result`, `@vp/domain`, `@vp/errors` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing`, `@vp/web-testing` |
| `@vp/core` | `packages/server/core` | app | server | T6 | `@kit/result`, `@vp/domain`, `@vp/errors`, `@vp/permissions` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/db` | `packages/server/db` | app | server | T6 | `@kit/result`, `@vp/domain`, `@vp/job-contracts`, `@vp/storage`, `@vp/validation` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/env-schema` | `packages/server/env-schema` | app | server | T6 | `@kit/pagination`, `@kit/primitives`, `@kit/result`, `@vp/domain`, `@vp/observability` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/api-contracts` | `packages/universal/api-contracts` | app | universal | T6 | `@kit/pagination`, `@kit/primitives`, `@kit/result`, `@vp/domain`, `@vp/errors`, `@vp/permissions`, `@vp/validation` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/domain-rules` | `packages/universal/domain-rules` | app | universal | T6 | `@kit/machine`, `@kit/primitives`, `@kit/result`, `@vp/domain`, `@vp/errors`, `@vp/permissions`, `@vp/validation` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/api-client` | `packages/client/api-client` | app | client | T7 | `@vp/api-contracts` | `@kit/result`, `@kit/tsconfig`, `@vp/domain-rules`, `@vp/testing`, `@vp/validation` |
| `@kit/components` | `packages/platform/client/components` | platform | client | T7 | `@kit/design-tokens`, `@kit/ui` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing`, `@vp/web-testing` |
| `@kit/forms` | `packages/platform/client/forms` | platform | client | T7 | `@kit/result`, `@kit/ui`, `@vp/errors` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing`, `@vp/validation`, `@vp/web-testing` |
| `@kit/web-telemetry` | `packages/platform/client/web-telemetry` | platform | client | T7 | `@kit/result` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing`, `@vp/web-testing` |
| `@kit/config` | `packages/platform/server/config` | platform | server | T7 | `@kit/composition`, `@kit/logger`, `@kit/result`, `@vp/env-schema` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/adapters` | `packages/server/adapters` | app | server | T7 | `@kit/composition`, `@kit/concurrency`, `@kit/di`, `@kit/primitives`, `@kit/result`, `@vp/core`, `@vp/db`, `@vp/dev-identity`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/job-contracts`, `@vp/observability`, `@vp/permissions`, `@vp/storage`, `@vp/validation` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/deploy` | `packages/server/deploy` | app | server | T7 | `@kit/result`, `@vp/env-schema`, `@vp/job-contracts` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/fingerprint` | `packages/server/fingerprint` | app | server | T7 | `@kit/result`, `@vp/core`, `@vp/domain`, `@vp/errors`, `@vp/ffmpeg` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/api` | `apps/server/api` | app | server | T8 | `@kit/composition`, `@kit/concurrency`, `@kit/config`, `@kit/intl`, `@kit/logger`, `@kit/pagination`, `@kit/primitives`, `@kit/result`, `@vp/adapters`, `@vp/api-contracts`, `@vp/core`, `@vp/db`, `@vp/dev-identity`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/job-contracts`, `@vp/observability`, `@vp/permissions`, `@vp/storage`, `@vp/validation`, `@vp/whisper` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/worker` | `apps/server/worker` | app | server | T8 | `@kit/composition`, `@kit/config`, `@kit/logger`, `@kit/primitives`, `@kit/result`, `@vp/adapters`, `@vp/api-contracts`, `@vp/core`, `@vp/domain`, `@vp/domain-rules`, `@vp/env-schema`, `@vp/errors`, `@vp/events`, `@vp/ffmpeg`, `@vp/fingerprint`, `@vp/job-contracts`, `@vp/observability`, `@vp/storage`, `@vp/validation`, `@vp/whisper` | `@kit/tsconfig`, `@vp/testing` |
| `@vp/queries` | `packages/client/queries` | app | client | T8 | `@kit/components`, `@kit/intl`, `@kit/intl-react`, `@kit/result`, `@kit/security-headers`, `@kit/ui`, `@vp/api-client`, `@vp/api-contracts`, `@vp/domain`, `@vp/errors`, `@vp/messages`, `@vp/permissions`, `@vp/permissions-react` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing`, `@vp/web-testing` |
| `@vp/web-testing` | `packages/client/web-testing` | app | client | T8 | `@vp/api-client`, `@vp/api-contracts`, `@vp/errors` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing` |
| `@vp/studio` | `apps/client/studio` | app | client | T9 | `@kit/components`, `@kit/design-tokens`, `@kit/forms`, `@kit/intl`, `@kit/intl-react`, `@kit/result`, `@kit/security-headers`, `@kit/ui`, `@kit/web-telemetry`, `@vp/api-client`, `@vp/api-contracts`, `@vp/domain`, `@vp/domain-rules`, `@vp/errors`, `@vp/intl-formats`, `@vp/permissions`, `@vp/permissions-react`, `@vp/queries`, `@vp/validation` | `@kit/primitives`, `@kit/tsconfig`, `@kit/vite-preset`, `@vp/testing`, `@vp/web-testing` |
| `@vp/web` | `apps/client/web` | app | client | T9 | `@kit/components`, `@kit/design-tokens`, `@kit/forms`, `@kit/intl`, `@kit/intl-react`, `@kit/primitives`, `@kit/result`, `@kit/security-headers`, `@kit/ui`, `@kit/web-telemetry`, `@vp/api-client`, `@vp/api-contracts`, `@vp/domain`, `@vp/domain-rules`, `@vp/intl-formats`, `@vp/messages`, `@vp/permissions`, `@vp/permissions-react`, `@vp/queries`, `@vp/validation` | `@kit/tsconfig`, `@kit/vite-preset`, `@vp/errors`, `@vp/web-testing` |
| `@vp/workbench` | `packages/client/workbench` | app | client | T9 | - | `@kit/components`, `@kit/design-tokens`, `@kit/intl`, `@kit/intl-react`, `@kit/result`, `@kit/tsconfig`, `@kit/ui`, `@kit/vite-preset`, `@vp/api-client`, `@vp/api-contracts`, `@vp/messages`, `@vp/queries`, `@vp/testing`, `@vp/web-testing` |
| `@vp/upload-client` | `packages/server/upload-client` | app | server | T9 | `@kit/logger`, `@kit/result` | `@kit/tsconfig`, `@vp/adapters`, `@vp/api`, `@vp/dev-identity`, `@vp/env-schema`, `@vp/testing` |
| `@vp/demo` | `packages/server/demo` | app | server | T10 | `@kit/result`, `@vp/db`, `@vp/dev-identity`, `@vp/domain`, `@vp/env-schema`, `@vp/errors`, `@vp/upload-client` | `@kit/tsconfig`, `@vp/testing` |
