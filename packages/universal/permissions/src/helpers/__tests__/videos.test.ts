import { describe, expect, it } from 'vitest';
import {
  adminUser,
  creatorUser,
  foreignVideo,
  guestUser,
  moderatorUser,
  privateVideo,
  publicVideo,
  standardUser,
  unlistedVideo,
} from '../../__mocks__/fixtures';
import {
  canCreateVideo,
  canDeleteVideo,
  canPublishVideo,
  canReactVideo,
  canReadVideo,
  canUpdateVideo,
} from '../videos';

describe('helpers/videos: Video Action Helpers', () => {
  describe('canReadVideo', () => {
    it('allows guest to read public and unlisted videos', () => {
      expect(canReadVideo({ user: guestUser })).toBe(true);
      expect(canReadVideo({ user: guestUser, video: publicVideo })).toBe(true);
      expect(canReadVideo({ user: guestUser, video: unlistedVideo })).toBe(true);
    });

    it('forbids guest from reading private videos', () => {
      expect(canReadVideo({ user: guestUser, video: privateVideo })).toBe(false);
    });

    it('allows creator to read their own private video', () => {
      expect(canReadVideo({ user: creatorUser, video: privateVideo })).toBe(true);
    });

    it('forbids standard user from reading someone elses private video', () => {
      expect(canReadVideo({ user: standardUser, video: privateVideo })).toBe(false);
    });

    it('allows moderator and admin to read any private video', () => {
      expect(canReadVideo({ user: moderatorUser, video: privateVideo })).toBe(true);
      expect(canReadVideo({ user: adminUser, video: privateVideo })).toBe(true);
    });
  });

  describe('canCreateVideo & canReactVideo', () => {
    it('forbids unauthenticated guest', () => {
      expect(canCreateVideo({ user: guestUser })).toBe(false);
      expect(canReactVideo({ user: guestUser })).toBe(false);
    });

    it('allows authenticated users to create and react', () => {
      expect(canCreateVideo({ user: standardUser })).toBe(true);
      expect(canReactVideo({ user: standardUser })).toBe(true);
      expect(canCreateVideo({ user: creatorUser })).toBe(true);
      expect(canCreateVideo({ user: adminUser })).toBe(true);
    });
  });

  describe('canUpdateVideo & canDeleteVideo', () => {
    it('forbids unauthenticated guest', () => {
      expect(canUpdateVideo({ user: guestUser, video: publicVideo })).toBe(false);
      expect(canDeleteVideo({ user: guestUser, video: publicVideo })).toBe(false);
    });

    it('allows video owner to update and delete', () => {
      expect(canUpdateVideo({ user: creatorUser, video: publicVideo })).toBe(true);
      expect(canDeleteVideo({ user: creatorUser, video: publicVideo })).toBe(true);
    });

    it('forbids non-owner from updating or deleting', () => {
      expect(canUpdateVideo({ user: standardUser, video: publicVideo })).toBe(false);
      expect(canDeleteVideo({ user: standardUser, video: publicVideo })).toBe(false);
    });

    it('allows admin to update and delete any video', () => {
      expect(canUpdateVideo({ user: adminUser, video: foreignVideo })).toBe(true);
      expect(canDeleteVideo({ user: adminUser, video: foreignVideo })).toBe(true);
    });
  });

  describe('canPublishVideo', () => {
    it('forbids guest and standard user from publishing', () => {
      expect(canPublishVideo({ user: guestUser })).toBe(false);
      expect(canPublishVideo({ user: standardUser, video: publicVideo })).toBe(false);
    });

    it('allows creator to publish own video but not foreign video', () => {
      expect(canPublishVideo({ user: creatorUser, video: publicVideo })).toBe(true);
      expect(canPublishVideo({ user: creatorUser, video: foreignVideo })).toBe(false);
    });

    it('allows admin to publish any video', () => {
      expect(canPublishVideo({ user: adminUser, video: foreignVideo })).toBe(true);
    });
  });
});
