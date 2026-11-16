import { DLQ_STATUSES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

export const DLQ_ENTRY = defineMachine({
  name: 'dlq-entry',
  states: DLQ_STATUSES,
  initial: ['PARKED'],
  final: ['REPLAYED', 'DISCARDED'],
  events: {
    replay: { from: ['PARKED'], to: 'REPLAYED' },
    discard: { from: ['PARKED'], to: 'DISCARDED' },
  },
});
