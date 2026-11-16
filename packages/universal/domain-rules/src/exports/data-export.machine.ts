import { DATA_EXPORT_EDGES, DATA_EXPORT_STATUSES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

/** @internal */
export const DATA_EXPORT = defineMachine({
  name: 'data-export',
  states: DATA_EXPORT_STATUSES,
  initial: ['queued'],
  final: ['failed', 'expired'],
  events: DATA_EXPORT_EDGES,
});
