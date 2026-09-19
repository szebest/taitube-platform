import { describe, expect, it } from 'vitest';
import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  sampleComment,
  standardUser,
} from '../../__mocks__/fixtures';
import { canCreateComment, canDeleteComment, canPinComment } from '../comments';

describe('helpers/comments: Comment Action Helpers', () => {
  describe('canCreateComment', () => {
    it('forbids unauthenticated guest', () => {
      expect(canCreateComment({ user: guestUser })).toBe(false);
    });

    it('allows authenticated users to create comments', () => {
      expect(canCreateComment({ user: standardUser })).toBe(true);
      expect(canCreateComment({ user: creatorUser })).toBe(true);
    });
  });

  describe('canDeleteComment', () => {
    it('allows author to delete their own comment', () => {
      expect(canDeleteComment({ user: standardUser, comment: sampleComment })).toBe(true);
    });

    it('forbids other users from deleting authors comment', () => {
      expect(
        canDeleteComment({
          user: { id: 'usr-999', role: 'USER' },
          comment: sampleComment,
        })
      ).toBe(false);
    });

    it('allows video owner to delete comments on their video', () => {
      expect(canDeleteComment({ user: creatorUser, comment: sampleComment })).toBe(true);
    });

    it('allows moderator and admin to delete any comment', () => {
      expect(canDeleteComment({ user: moderatorUser, comment: sampleComment })).toBe(true);
      expect(canDeleteComment({ user: adminUser, comment: sampleComment })).toBe(true);
    });
  });

  describe('canPinComment', () => {
    it('allows video owner to pin comment on their video', () => {
      expect(
        canPinComment({
          user: creatorUser,
          videoOwnerId: 'creator-1',
          comment: sampleComment,
        })
      ).toBe(true);
    });

    it('forbids other users from pinning comments', () => {
      expect(
        canPinComment({
          user: standardUser,
          videoOwnerId: 'creator-1',
          comment: sampleComment,
        })
      ).toBe(false);
    });

    it('allows admin to pin any comment', () => {
      expect(
        canPinComment({
          user: adminUser,
          videoOwnerId: 'creator-1',
        })
      ).toBe(true);
    });
  });
});
