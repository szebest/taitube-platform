# @kit/logger

A pino logger with one shape for every process: `json` for a collector, `pretty` for a terminal, credential
redaction, error serialization and the active trace and span ids on every line.

```sh
pnpm add @kit/logger pino @opentelemetry/api
```

Tokens and registries: none. `createLogger` takes a `LoggerConfig`; `LogContext` carries bindings across async calls.

```ts
import { createLogger } from '@kit/logger';

const log = createLogger({ service: 'api', level: 'info', format: 'json' });
log.info({ videoId: 'v1' }, 'video accepted');
```
