# @kit/runtime

Environment tokens (`Clock`, `Random`, `EnvSource`, `Fetch`, `CookieJar`) and their providers for Node, Bun and
the browser. A package asks a token instead of calling `Date.now()`, `fetch` or reading an env var, so it runs
anywhere and a spec hands it a fake clock with no timers.

Install: `pnpm add @kit/runtime`. It depends on `@kit/di`.

Tokens: declares `Clock`, `Random`, `EnvSource`, `Fetch` and `CookieJar` and consumes none. Registries: none; the entries return providers for the app's `@kit/di` registry.

```ts
import { createRegistry } from '@kit/di';
import { Clock } from '@kit/runtime';
import { nodeRuntime } from '@kit/runtime/node';

const registry = createRegistry().provide(...nodeRuntime({ env: process.env }));
const clock = registry.get(Clock);
```

In the browser: `browserRuntime({ env: import.meta.env, cookies: cookieStore })` from `@kit/runtime/browser`.
