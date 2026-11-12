import { CHANNEL_IMAGE_UPLOAD_EDGES, IMAGE_UPLOAD_STATUSES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

export const CHANNEL_IMAGE_UPLOAD = defineMachine({
  name: 'channel-image-upload',
  states: IMAGE_UPLOAD_STATUSES,
  initial: ['issued'],
  final: ['purged'],
  events: CHANNEL_IMAGE_UPLOAD_EDGES,
});
