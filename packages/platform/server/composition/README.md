# @kit/composition

A synchronous dependency container with start and dispose lifecycles, plus a once-only shutdown for a process.
Factories never do I/O; a token's `start()` does.

```sh
pnpm add @kit/composition
```

Tokens: none of its own. It resolves the `Token<T>` values of `@kit/di`, re-exported as `token`.
Helpers: `Container` (`provide`, `override`, `get`, `start`, `dispose`), `closeOnDispose`, `shutdownOnce`, `exitOnSignals`.

```ts
import { Container, token } from '@kit/composition';

const Greeting = token<string>('Greeting');
const container = new Container().provide(Greeting, () => 'hello');

container.get(Greeting); // 'hello'
await container.start();
await container.dispose();
```
