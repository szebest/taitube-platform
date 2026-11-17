# @kit/config

Validates an environment record against the app's env schema and reports every invalid key, redacted, before a
process boots half-configured. `parseEnv` returns a `Result`, `loadEnv` throws, `loadEnvOrExit` logs and exits.

```sh
pnpm add @kit/config
```

Tokens and registries: none. The schema it checks against is the app's own `@vp/env-schema`.

```ts
import { loadEnv } from '@kit/config';

const env = loadEnv(process.env);
```
