# @kit/machine

A state machine as data: states, initial and final states and the events between them, checked by the compiler.
`defineMachine` gives the transition lookups, `toMermaid` draws it. No dependencies.

Install: `pnpm add @kit/machine`. No peers.

Tokens: none. Registries: none; the app owns every machine it defines.

```ts
import { defineMachine, toMermaid } from '@kit/machine';

const door = defineMachine({
  name: 'door',
  states: ['open', 'closed'],
  initial: ['closed'],
  final: [],
  events: {
    open: { from: ['closed'], to: 'open' },
    close: { from: ['open'], to: 'closed' },
  },
});

door.next('closed', 'open'); // 'open'
door.next('open', 'open'); // undefined
toMermaid(door);
```
