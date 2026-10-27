import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import type { CaptionResource, UserContext } from '../../types/index';
import { canManageCaptions, canReadCaptions } from '../captions';

const privateCaptions: CaptionResource = {
  videoId: 'vid-priv',
  ownerId: creatorUser.id,
  visibility: 'private',
};

const CHECKS = {
  read: (user: UserContext | null, caption: CaptionResource) => canReadCaptions({ user, caption }),
  manage: (user: UserContext | null, caption: CaptionResource) =>
    canManageCaptions({ user, caption }),
};

type Action = keyof typeof CHECKS;

const granted = (user: UserContext | null, caption: CaptionResource) =>
  (Object.keys(CHECKS) as Action[]).filter((action) => CHECKS[action](user, caption));

describe('helpers/captions: who may do what to the captions of a video', () => {
  it.each<{ who: string; user: UserContext | null; allowed: Action[] }>([
    { who: 'a guest', user: guestUser, allowed: [] },
    { who: 'a stranger', user: standardUser, allowed: [] },
    { who: 'a moderator', user: moderatorUser, allowed: ['read'] },
    { who: 'the owner', user: creatorUser, allowed: ['read', 'manage'] },
    { who: 'an admin', user: adminUser, allowed: ['read', 'manage'] },
  ])('on a private video, $who may $allowed', ({ user, allowed }) => {
    expect(granted(user, privateCaptions)).toEqual(allowed);
  });

  it.each([
    { who: 'a guest', user: guestUser },
    { who: 'a stranger', user: standardUser },
  ])('lets $who read, and only read, a public video captions', ({ user }) => {
    expect(granted(user, { ...privateCaptions, visibility: 'public' })).toEqual(['read']);
  });
});
