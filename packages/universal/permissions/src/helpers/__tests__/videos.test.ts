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
import type { UserContext, VideoResource } from '../../types/index';
import { canDeleteVideo, canReactVideo, canReadVideo, canUpdateVideo } from '../videos';

type VideoCase = {
  scenario: string;
  user: UserContext | null;
  video?: VideoResource;
  expected: boolean;
};

type ViewerCase = {
  scenario: string;
  user: UserContext | null;
  expected: boolean;
};

describe('helpers/videos: Video Action Helpers', () => {
  describe('canReadVideo', () => {
    it.each<VideoCase>([
      { scenario: 'a guest reading the video collection', user: guestUser, expected: true },
      {
        scenario: 'a guest reading a public video',
        user: guestUser,
        video: publicVideo,
        expected: true,
      },
      {
        scenario: 'a guest reading an unlisted video',
        user: guestUser,
        video: unlistedVideo,
        expected: true,
      },
      {
        scenario: 'a guest reading a private video',
        user: guestUser,
        video: privateVideo,
        expected: false,
      },
      {
        scenario: 'the owner reading their own private video',
        user: creatorUser,
        video: privateVideo,
        expected: true,
      },
      {
        scenario: 'another user reading a private video',
        user: standardUser,
        video: privateVideo,
        expected: false,
      },
      {
        scenario: 'a moderator reading a private video',
        user: moderatorUser,
        video: privateVideo,
        expected: true,
      },
      {
        scenario: 'an admin reading a private video',
        user: adminUser,
        video: privateVideo,
        expected: true,
      },
    ])('$scenario: $expected', ({ user, video, expected }) => {
      expect(canReadVideo({ user, video })).toBe(expected);
    });
  });

  describe('canReactVideo', () => {
    it.each<ViewerCase>([
      { scenario: 'a guest', user: guestUser, expected: false },
      { scenario: 'a standard user', user: standardUser, expected: true },
      { scenario: 'a creator', user: creatorUser, expected: true },
      { scenario: 'an admin', user: adminUser, expected: true },
    ])('$scenario: $expected', ({ user, expected }) => {
      expect(canReactVideo({ user })).toBe(expected);
    });
  });

  describe.each([
    { helper: 'canUpdateVideo', check: canUpdateVideo },
    { helper: 'canDeleteVideo', check: canDeleteVideo },
  ])('$helper', ({ check }) => {
    it.each<VideoCase>([
      { scenario: 'a guest', user: guestUser, video: publicVideo, expected: false },
      { scenario: 'the video owner', user: creatorUser, video: publicVideo, expected: true },
      { scenario: 'another user', user: standardUser, video: publicVideo, expected: false },
      {
        scenario: 'an admin on a foreign video',
        user: adminUser,
        video: foreignVideo,
        expected: true,
      },
    ])('$scenario: $expected', ({ user, video, expected }) => {
      expect(check({ user, video })).toBe(expected);
    });
  });
});
