import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import { canUpdateLiveStream } from '../live-streams';

describe('helpers/live-streams: who may run a channel broadcast', () => {
  it.each([
    { who: 'the owner', user: standardUser, allowed: true },
    { who: 'another creator', user: creatorUser, allowed: false },
    { who: 'a guest', user: guestUser, allowed: false },
    { who: 'an admin', user: adminUser, allowed: true },
  ])('lets $who update the stream: $allowed', ({ user, allowed }) => {
    expect(canUpdateLiveStream({ user, stream: { ownerId: standardUser.id } })).toBe(allowed);
  });
});
