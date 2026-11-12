import { machineFindings } from '@vp/machine';
import { CHANNEL_INVITE } from '../channel-invite.machine';

describe('@vp/domain-rules: CHANNEL_INVITE', () => {
  it('has no structural finding', () => {
    expect(machineFindings(CHANNEL_INVITE)).toEqual([]);
  });

  it('lets an invitee accept and decline from the same states, as the answer rule assumes', () => {
    expect(CHANNEL_INVITE.sources('accept')).toEqual(CHANNEL_INVITE.sources('decline'));
  });
});
