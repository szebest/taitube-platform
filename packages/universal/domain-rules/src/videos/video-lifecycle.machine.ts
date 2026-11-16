import { VIDEO_LIFECYCLE_EDGES, VIDEO_STATUSES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

export const VIDEO_LIFECYCLE = defineMachine({
  name: 'video-lifecycle',
  states: VIDEO_STATUSES,
  initial: ['UPLOADING', 'LIVE'],
  final: ['DELETED'],
  events: VIDEO_LIFECYCLE_EDGES,
});
