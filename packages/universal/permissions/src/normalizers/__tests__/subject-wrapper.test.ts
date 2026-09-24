import {
  createSubject,
  toChannelSubject,
  toCommentSubject,
  toUploadSubject,
  toVideoSubject,
} from '../subject-wrapper';
import { normalizeVideoResource } from '../video.normalizer';

describe('normalizers/subject-wrapper: CASL Subject Wrappers', () => {
  it.each<{
    scenario: string;
    build: () => object | undefined;
    expected: Record<string, unknown>;
  }>([
    {
      scenario: 'toVideoSubject resolves ownerId from userId and defaults visibility',
      build: () => toVideoSubject({ id: 'v1', userId: 'u1' }),
      expected: { ownerId: 'u1', visibility: 'public' },
    },
    {
      scenario: 'toChannelSubject resolves ownerId from userId',
      build: () => toChannelSubject({ id: 'c1', userId: 'u1' }),
      expected: { ownerId: 'u1' },
    },
    {
      scenario: 'toCommentSubject takes the video owner passed alongside',
      build: () => toCommentSubject({ id: 'cm1' }, 'video-owner'),
      expected: { videoOwnerId: 'video-owner' },
    },
    {
      scenario: 'toUploadSubject falls back to the owner of the video',
      build: () => toUploadSubject(null, { ownerId: 'owner-1' }),
      expected: { ownerId: 'owner-1' },
    },
  ])('$scenario', ({ build, expected }) => {
    expect(build()).toMatchObject(expected);
  });

  it('createSubject returns undefined when the resource normalized away', () => {
    expect(createSubject('Video', normalizeVideoResource(null))).toBeUndefined();
  });
});
