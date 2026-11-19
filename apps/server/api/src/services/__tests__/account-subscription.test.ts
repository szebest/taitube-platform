import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { followsChannel } from '../account-subscription';

const FAN = '00000000-0000-7000-8000-0000000000a1';
const FAN_CHANNELS = [
  '00000000-0000-7000-8000-0000000000b1',
  '00000000-0000-7000-8000-0000000000b2',
];
const CHANNEL = '00000000-0000-7000-8000-0000000000c1';

describe('apps/server/api/services: followsChannel', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    expectOk(
      await repositories.channels.create({
        id: CHANNEL,
        userId: '00000000-0000-7000-8000-0000000000d1',
        handle: 'creator',
        displayName: 'Creator',
      })
    );
  });

  it.each([
    { scenario: 'no channel of the account follows it', from: [], follows: false },
    { scenario: 'one channel of the account follows it', from: [FAN_CHANNELS[1]], follows: true },
    { scenario: 'two channels of the account follow it', from: FAN_CHANNELS, follows: true },
  ])('answers $follows when $scenario', async ({ from, follows }) => {
    for (const as of from) {
      expectOk(await repositories.subscriptions.subscribe(FAN, as ?? '', CHANNEL));
    }

    expect(expectOk(await followsChannel(repositories.subscriptions, FAN, CHANNEL))).toBe(follows);
  });
});
