import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  sampleComment,
  standardUser,
} from '../../__mocks__/fixtures.js';
import type { CommentResource, UserContext } from '../../types/index.js';
import { canCreateComment, canDeleteComment, canPinComment } from '../comments.js';

const strangerUser: UserContext = { id: 'usr-999', role: 'USER' };

describe('helpers/comments: Comment Action Helpers', () => {
  describe('canCreateComment', () => {
    it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
      { scenario: 'a guest', user: guestUser, expected: false },
      { scenario: 'a standard user', user: standardUser, expected: true },
      { scenario: 'a creator', user: creatorUser, expected: true },
    ])('$scenario: $expected', ({ user, expected }) => {
      expect(canCreateComment({ user })).toBe(expected);
    });
  });

  describe('canDeleteComment', () => {
    it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
      { scenario: 'the comment author', user: standardUser, expected: true },
      { scenario: 'an unrelated user', user: strangerUser, expected: false },
      { scenario: 'the owner of the video it sits under', user: creatorUser, expected: true },
      { scenario: 'a moderator', user: moderatorUser, expected: true },
      { scenario: 'an admin', user: adminUser, expected: true },
    ])('$scenario: $expected', ({ user, expected }) => {
      expect(canDeleteComment({ user, comment: sampleComment })).toBe(expected);
    });
  });

  describe('canPinComment', () => {
    it.each<{
      scenario: string;
      user: UserContext | null;
      comment?: CommentResource;
      expected: boolean;
    }>([
      {
        scenario: 'the owner of the video it sits under',
        user: creatorUser,
        comment: sampleComment,
        expected: true,
      },
      {
        scenario: 'an unrelated user',
        user: standardUser,
        comment: sampleComment,
        expected: false,
      },
      { scenario: 'an admin with no comment in hand', user: adminUser, expected: true },
    ])('$scenario: $expected', ({ user, comment, expected }) => {
      expect(canPinComment({ user, videoOwnerId: 'creator-1', comment })).toBe(expected);
    });
  });
});
