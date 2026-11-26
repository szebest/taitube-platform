import { defineMachine } from '@kit/machine';
import { GENERATION_STATUSES, VIDEO_GENERATION_EDGES } from '@vp/domain';

export const VIDEO_GENERATION = defineMachine({
  name: 'video-generation',
  states: GENERATION_STATUSES,
  initial: ['uploading', 'rendering', 'retired'],
  final: ['failed', 'purged'],
  events: VIDEO_GENERATION_EDGES,
});
