import { defineMachine } from '@kit/machine';
import { CHANNEL_INVITE_STATUSES } from '@vp/domain';

export const CHANNEL_INVITE = defineMachine({
  name: 'channel-invite',
  states: CHANNEL_INVITE_STATUSES,
  initial: ['pending'],
  final: ['accepted', 'declined', 'revoked', 'expired'],
  events: {
    accept: { from: ['pending'], to: 'accepted' },
    decline: { from: ['pending'], to: 'declined' },
    revoke: { from: ['pending'], to: 'revoked' },
    expire: { from: ['pending'], to: 'expired' },
  },
});
