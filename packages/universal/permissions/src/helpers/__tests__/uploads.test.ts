import {
  adminUser,
  creatorUser,
  foreignUpload,
  foreignVideo,
  guestUser,
  publicVideo,
  sampleUpload,
  standardUser,
} from '../../__mocks__/fixtures';
import type { UploadResource, UserContext, VideoResource } from '../../types/index';
import { canAccessUpload } from '../uploads';

describe('helpers/uploads: canAccessUpload', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    upload?: UploadResource;
    video?: VideoResource;
    expected: boolean;
  }>([
    { scenario: 'a guest', user: guestUser, upload: sampleUpload, expected: false },
    { scenario: 'the upload owner', user: creatorUser, upload: sampleUpload, expected: true },
    {
      scenario: 'the owner of the video behind the upload',
      user: creatorUser,
      video: publicVideo,
      expected: true,
    },
    { scenario: 'another user', user: standardUser, upload: foreignUpload, expected: false },
    {
      scenario: 'another user via the video behind the upload',
      user: standardUser,
      video: foreignVideo,
      expected: false,
    },
    {
      scenario: 'an admin on a foreign upload',
      user: adminUser,
      upload: foreignUpload,
      expected: true,
    },
  ])('$scenario: $expected', ({ user, upload, video, expected }) => {
    expect(canAccessUpload({ user, upload, video })).toBe(expected);
  });
});
