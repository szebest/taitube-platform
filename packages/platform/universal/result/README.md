# @kit/result

`Result<T, E>` for code that returns a failure instead of throwing it: `ok` and `err`, combinators, async
chaining and the two boundary helpers that turn a throw into a value. No dependencies.

Install: `pnpm add @kit/result`. No peers.

Tokens: none. Registries: none.

```ts
import { err, fromPromise, isOk, map, ok, parseJson, tryCatch, type Result } from '@kit/result';

const half = (n: number): Result<number, 'odd'> => (n % 2 === 0 ? ok(n / 2) : err('odd'));

map(half(8), (value) => value + 1); // ok(5)
parseJson('{"a":1}'); // ok({ a: 1 })
tryCatch(() => JSON.parse('x'), () => 'bad json'); // err('bad json')
await fromPromise(fetch('/x'), () => 'network'); // Result<Response, 'network'>
```
