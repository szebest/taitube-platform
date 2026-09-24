import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { describeChannelRepositoryContract } from '../../../__tests__/contract/channel-repository.contract';
import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { InMemoryChannelRepository } from '../in-memory-channel-repository';

describeChannelRepositoryContract(inMemorySubject);

describe('InMemoryChannelRepository dev seed', () => {
  it('holds the dev channels from construction and restores them on clear', async () => {
    const channels = new InMemoryChannelRepository();
    expectOk(
      await channels.create({
        userId: '00000000-0000-7000-8000-0000000001aa',
        handle: 'temporary',
        displayName: 'Temporary',
      })
    );

    channels.clear();

    expect(expectOk(await channels.findByHandle('temporary'))).toBeNull();
    expect(expectOk(await channels.findByHandle('dev'))).toMatchObject({
      id: SEEDED.channelId,
      userId: SEEDED.userId,
      displayName: 'Dev Channel',
    });
    expect(expectOk(await channels.findByUserId(SEEDED.otherUserId))?.id).toBe(
      SEEDED.otherChannelId
    );
  });
});
