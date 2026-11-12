import { LIVE_STREAM_STATUSES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

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
