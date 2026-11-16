# @kit/di

Typed tokens and an immutable registry. A package declares the token it needs; the app provides it once, at
its composition root.

```ts
import { createRegistry, provide, token } from '@kit/di';

interface Greeter {
  greet(name: string): string;
}
export const Greeter = token<Greeter>('Greeter');

const registry = createRegistry().provide(provide(Greeter, { greet: (name) => `Hello, ${name}` }));

const greeter = registry.get(Greeter);
if (greeter.ok) greeter.value.greet('Ada');
else throw new Error(greeter.error.message);
```

`get` returns a `Result` from `@vp/result`; a token nobody provided is `MissingProvider`, never an exception.
In a spec, substitute a provider with `createRegistry().provide(provide(Token, fake))`.
