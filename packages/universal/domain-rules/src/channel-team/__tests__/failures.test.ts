import { ErrorCodes } from '@vp/errors';
import { channelMembershipRequired } from '../failures';

describe('@vp/domain-rules: channel team failures', () => {
  it('names the channel the caller is not on', () => {
    expect(channelMembershipRequired('chan-9')).toMatchObject({
      code: ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED,
      channelId: 'chan-9',
    });
  });
});
