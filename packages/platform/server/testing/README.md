# @kit/testing

The spec helpers a package shares: a vitest config factory, an environment scope, `Result` unwrapping, throwaway
signing keys and signed tokens, a log capture and an entrypoint runner.

```sh
pnpm add -D @kit/testing vite-plus tsx
```

Tokens and registries: none. Entry points: `definePackageTestConfig` and `withEnv` (`.`), `expectOk` and
`expectErr` (`./result`), `signingKey` and `signJwt` (`./jwt`), `captureLog` (`./log-capture`) and
`runEntrypoint` (`./run-entrypoint`).

```ts
import { definePackageTestConfig } from '@kit/testing';

export default definePackageTestConfig({ test: { testTimeout: 60_000 } });
```
