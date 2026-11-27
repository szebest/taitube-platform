import { defineMachine } from '@kit/machine';
import { EXPERIMENT_EDGES, EXPERIMENT_STATUSES } from '@vp/domain';

export const EXPERIMENT = defineMachine({
  name: 'experiment',
  states: EXPERIMENT_STATUSES,
  initial: ['running'],
  final: ['finished', 'stopped'],
  events: EXPERIMENT_EDGES,
});
