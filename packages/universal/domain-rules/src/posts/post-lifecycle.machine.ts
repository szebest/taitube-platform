import { defineMachine } from '@kit/machine';
import { POST_LIFECYCLE_EDGES, POST_STATUSES } from '@vp/domain';

export const POST_LIFECYCLE = defineMachine({
  name: 'post-lifecycle',
  states: POST_STATUSES,
  initial: ['draft', 'scheduled', 'published'],
  final: ['published'],
  events: POST_LIFECYCLE_EDGES,
});
