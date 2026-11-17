import { defineMachine } from '@kit/machine';
import { LIVE_STREAM_STATUSES } from '@vp/domain';

export const LIVE_STREAM = defineMachine({
  name: 'live-stream',
  states: LIVE_STREAM_STATUSES,
  initial: ['IDLE'],
  final: ['ENDED'],
  events: {
    goLive: { from: ['IDLE'], to: 'LIVE' },
    end: { from: ['LIVE'], to: 'ENDED' },
    requestStop: { from: ['LIVE'], to: 'LIVE' },
  },
});
