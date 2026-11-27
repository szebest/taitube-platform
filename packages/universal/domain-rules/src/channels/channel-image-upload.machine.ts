import { defineMachine } from '@kit/machine';
import { CHANNEL_IMAGE_UPLOAD_EDGES, IMAGE_UPLOAD_STATUSES } from '@vp/domain';

/** @internal */
export const CHANNEL_IMAGE_UPLOAD = defineMachine({
  name: 'channel-image-upload',
  states: IMAGE_UPLOAD_STATUSES,
  initial: ['issued'],
  final: ['purged'],
  events: CHANNEL_IMAGE_UPLOAD_EDGES,
});
