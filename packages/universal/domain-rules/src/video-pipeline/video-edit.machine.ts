import { defineMachine } from '@kit/machine';
import { VIDEO_EDIT_EDGES, VIDEO_EDIT_STATUSES } from '@vp/domain';

export const VIDEO_EDIT = defineMachine({
  name: 'video-edit',
  states: VIDEO_EDIT_STATUSES,
  initial: ['rendering'],
  final: [],
  events: VIDEO_EDIT_EDGES,
});
