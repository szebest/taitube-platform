import { describeChannelUserRestrictionRepositoryContract } from '../../../__tests__/contract/channel-user-restriction-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { InMemoryChannelUserRestrictionRepository } from '../in-memory-channel-user-restriction-repository';

describeChannelUserRestrictionRepositoryContract(inMemorySubject);

describe('InMemoryChannelUserRestrictionRepository', () => {
  it('names the shadow banned users of a channel, and not its bans or another channel', async () => {
    const restrictions = new InMemoryChannelUserRestrictionRepository();
    const restrict = (channelId: string, userId: string, kind: 'shadow' | 'ban') =>
      restrictions.apply({
        channelId,
        userId,
        kind,
        reason: null,
        expiresAt: null,
        createdBy: null,
      });
    await restrict('c1', 'shadowed', 'shadow');
    await restrict('c1', 'banned', 'ban');
    await restrict('c2', 'elsewhere', 'shadow');

    expect(restrictions.shadowedUserIds('c1')).toEqual(new Set(['shadowed']));
  });
});
