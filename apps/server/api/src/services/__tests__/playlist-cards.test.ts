import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { primaryCards } from '../playlist-cards';

const USER = '00000000-0000-7000-8000-00000000c001';
const NOBODY = '00000000-0000-7000-8000-00000000c002';

describe('apps/server/api/services: primaryCards', () => {
  it("keys each user's primary channel card by user id, once however often asked, and skips a user without one", async () => {
    const repositories = new InMemoryRepositories();
    const channelId = await seedPrimaryChannel(repositories, USER);

    const cards = expectOk(await primaryCards(repositories.channels, [USER, NOBODY, USER]));

    expect([...cards.keys()]).toEqual([USER]);
    expect(cards.get(USER)).toMatchObject({ id: channelId });
    expect(Object.keys(cards.get(USER) ?? {}).sort()).toEqual([
      'avatarUrl',
      'displayName',
      'handle',
      'id',
    ]);
  });
});
