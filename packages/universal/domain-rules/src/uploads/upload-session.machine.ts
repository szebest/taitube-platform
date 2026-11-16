import { UPLOAD_STATUSES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

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
