import { defineMachine } from '@kit/machine';
import { OUTBOX_STATUSES } from '@vp/domain';

export const OUTBOX_ROW = defineMachine({
  name: 'outbox-row',
  states: OUTBOX_STATUSES,
  initial: ['PENDING'],
  final: ['PUBLISHED', 'DEAD'],
  events: {
    publish: { from: ['PENDING'], to: 'PUBLISHED' },
    retry: { from: ['PENDING'], to: 'PENDING' },
    bury: { from: ['PENDING'], to: 'DEAD' },
  },
});
