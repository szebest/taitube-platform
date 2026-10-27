import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NotificationKind } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { usersSwitchedOn } from '../notification-switches';
import { saveSwitches, userId } from './notification-harness';

describe('apps/server/worker/stages: usersSwitchedOn', () => {
  let repositories: InMemoryRepositories;

  const switchedOn = async (kind: NotificationKind) =>
    [
      ...expectOk(await usersSwitchedOn(repositories, [userId(1), userId(2), userId(3)], kind)),
    ].sort();

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await saveSwitches(repositories, userId(1), { subscriptionUploads: false });
    await saveSwitches(repositories, userId(2), { repliesAndMentions: false });
  });

  it.each<{ kind: NotificationKind; users: number[] }>([
    { kind: 'upload', users: [2, 3] },
    { kind: 'live', users: [2, 3] },
    { kind: 'reply', users: [1, 3] },
    { kind: 'mention', users: [1, 3] },
    { kind: 'comment', users: [1, 3] },
    { kind: 'processing', users: [1, 2, 3] },
  ])('lets $kind through to the accounts $users, an unsaved one on its defaults', async (c) => {
    expect(await switchedOn(c.kind)).toEqual(c.users.map(userId));
  });
});
