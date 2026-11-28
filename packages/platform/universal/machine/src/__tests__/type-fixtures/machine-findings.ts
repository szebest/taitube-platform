import { defineMachine } from '../../define-machine';
import { machineFindings } from '../../machine-findings';
import { toMermaid } from '../../to-mermaid';

const door = defineMachine({
  name: 'door',
  states: ['open', 'closed'],
  initial: ['closed'],
  final: [],
  events: { open: { from: ['closed'], to: 'open' } },
});

expectTypeOf(machineFindings(door)).toEqualTypeOf<string[]>();
expectTypeOf(toMermaid(door)).toEqualTypeOf<string>();

// @ts-expect-error a machine, not its spec
machineFindings({ name: 'door' });

// @ts-expect-error a machine, not its spec
toMermaid({ name: 'door' });
