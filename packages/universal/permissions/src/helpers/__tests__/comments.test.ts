import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  sampleComment,
  standardUser,
} from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { canCreateComment, canDeleteComment, canPinComment, canUpdateComment } from '../comments';

const STRANGER: UserContext = { id: 'usr-9', role: 'USER' };
const VIDEO_OWNER_ID = 'creator-1';

const CHECKS = {
  create: (user: UserContext | null) => canCreateComment({ user }),
  update: (user: UserContext | null) => canUpdateComment({ user, comment: sampleComment }),
  delete: (user: UserContext | null) =>
    canDeleteComment({ user, comment: sampleComment, videoOwnerId: VIDEO_OWNER_ID }),
  pin: (user: UserContext | null) => canPinComment({ user, videoOwnerId: VIDEO_OWNER_ID }),
};

type Action = keyof typeof CHECKS;

describe('helpers/comments: who may do what to a comment', () => {
  it.each<{ scenario: string; user: UserContext | null; action: Action; expected: boolean }>([
    {
      scenario: 'an anonymous caller comments',
      user: guestUser,
      action: 'create',
      expected: false,
    },
    { scenario: 'a signed-in user comments', user: STRANGER, action: 'create', expected: true },
    { scenario: 'the author edits', user: standardUser, action: 'update', expected: true },
    { scenario: 'the video owner edits', user: creatorUser, action: 'update', expected: false },
    { scenario: 'a stranger edits', user: STRANGER, action: 'update', expected: false },
    { scenario: 'an anonymous caller edits', user: guestUser, action: 'update', expected: false },
    { scenario: 'the author deletes', user: standardUser, action: 'delete', expected: true },
    { scenario: 'the video owner deletes', user: creatorUser, action: 'delete', expected: true },
    { scenario: 'a moderator deletes', user: moderatorUser, action: 'delete', expected: true },
    { scenario: 'an admin deletes', user: adminUser, action: 'delete', expected: true },
    { scenario: 'a stranger deletes', user: STRANGER, action: 'delete', expected: false },
    { scenario: 'the video owner pins', user: creatorUser, action: 'pin', expected: true },
    { scenario: 'the author pins', user: standardUser, action: 'pin', expected: false },
    { scenario: 'a moderator pins', user: moderatorUser, action: 'pin', expected: false },
    { scenario: 'an admin pins', user: adminUser, action: 'pin', expected: true },
    { scenario: 'an anonymous caller pins', user: guestUser, action: 'pin', expected: false },
  ])('$scenario: $expected', ({ user, action, expected }) => {
    expect(CHECKS[action](user)).toBe(expected);
  });
});
