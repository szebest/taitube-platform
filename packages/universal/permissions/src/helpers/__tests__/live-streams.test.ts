import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import { canModerateLiveStream, canUpdateLiveStream } from '../live-streams';

describe('helpers/live-streams: who may run a channel broadcast', () => {
  it.each([
    { who: 'the owner', user: standardUser, update: true, moderate: true },
    { who: 'another creator', user: creatorUser, update: false, moderate: false },
    { who: 'a moderator', user: moderatorUser, update: false, moderate: true },
    { who: 'a guest', user: guestUser, update: false, moderate: false },
    { who: 'an admin', user: adminUser, update: true, moderate: true },
  ])('$who: update $update, moderate $moderate', ({ user, update, moderate }) => {
    const stream = { ownerId: standardUser.id };

    expect(canUpdateLiveStream({ user, stream })).toBe(update);
    expect(canModerateLiveStream({ user, stream })).toBe(moderate);
  });
});
