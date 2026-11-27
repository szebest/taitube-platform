# @kit/config

Validates an environment record against a Zod schema the app hands it and reports every invalid key, redacted, before a
process boots half-configured. `parseEnv` returns a `Result`, `loadEnv` throws, `loadEnvOrExit` logs and exits.

```sh
pnpm add @kit/config
```

Tokens and registries: none. The schema is a parameter; `zod` is a peer dependency.

```ts
import { loadEnv } from '@kit/config';
import { z } from 'zod';

const Schema = z.object({ PORT: z.coerce.number().default(3000) });

const env = loadEnv(Schema, process.env);
```
