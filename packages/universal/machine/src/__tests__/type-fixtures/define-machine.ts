import { defineMachine } from '../../define-machine';

const machine = defineMachine({
  name: 'door',
  states: ['open', 'closed'],
  initial: ['closed'],
  final: [],
  events: { open: { from: ['closed'], to: 'open' } },
});

const _legal: 'open' | 'closed' | undefined = machine.next('closed', 'open');

// @ts-expect-error an event that is not in the table
machine.next('closed', 'smash');

// @ts-expect-error a state that is not in the machine
machine.next('ajar', 'open');

defineMachine({
  name: 'bad-target',
  states: ['open', 'closed'],
  initial: ['closed'],
  final: [],
  // @ts-expect-error `to` is not one of the states
  events: { open: { from: ['closed'], to: 'ajar' } },
});

defineMachine({
  name: 'bad-source',
  states: ['open', 'closed'],
  initial: ['closed'],
  final: [],
  // @ts-expect-error `from` names a state the machine does not have
  events: { open: { from: ['ajar'], to: 'open' } },
});

defineMachine({
  name: 'bad-initial',
  states: ['open', 'closed'],
  // @ts-expect-error `initial` names a state the machine does not have
  initial: ['ajar'],
  final: [],
  events: { open: { from: ['closed'], to: 'open' } },
});
