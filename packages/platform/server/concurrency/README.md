# @kit/concurrency

Two small guards for calls to a slow or failing dependency: `Singleflight` shares one in-flight call per key,
and `CircuitBreaker` stops calling after consecutive failures until a cooldown passes.

```sh
pnpm add @kit/concurrency
```

Tokens and registries: none. The clock is passed in as `now`.

```ts
import { CircuitBreaker, Singleflight } from '@kit/concurrency';

const flights = new Singleflight();
const user = await flights.do('user:1', () => loadUser(1));

const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 10_000, now: Date.now });
if (breaker.allows()) breaker.recordSuccess();
```
