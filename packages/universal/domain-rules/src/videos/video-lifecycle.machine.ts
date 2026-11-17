import { defineMachine } from '@kit/machine';
import { VIDEO_LIFECYCLE_EDGES, VIDEO_STATUSES } from '@vp/domain';

export const VIDEO_LIFECYCLE = defineMachine({
  name: 'video-lifecycle',
  states: VIDEO_STATUSES,
  initial: ['UPLOADING', 'LIVE'],
  final: ['DELETED'],
  events: VIDEO_LIFECYCLE_EDGES,
});
