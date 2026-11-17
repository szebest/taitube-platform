import { defineMachine } from '@kit/machine';
import { UPLOAD_STATUSES } from '@vp/domain';

export const UPLOAD_SESSION = defineMachine({
  name: 'upload-session',
  states: UPLOAD_STATUSES,
  initial: ['OPEN'],
  final: ['COMPLETED', 'ABORTED'],
  events: {
    complete: { from: ['OPEN'], to: 'COMPLETED' },
    abort: { from: ['OPEN'], to: 'ABORTED' },
  },
});
