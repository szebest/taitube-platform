import type { Video } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideChannelAnalyticsRead, decideVideoAnalyticsRead } from '../read-analytics.rule';

describe('@vp/domain-rules: decideVideoAnalyticsRead', () => {
  it.each<{ scenario: string; viewer: UserContext }>([
    { scenario: 'the owner', viewer: OWNER },
    { scenario: 'an admin', viewer: ADMIN },
  ])('lets $scenario read a private video', ({ viewer }) => {
    const video = aVideo({ visibility: 'private' });

    expect(expectOk(decideVideoAnalyticsRead({ viewer, video, videoId: video.id }))).toBe(video);
  });

  it.each<{
    scenario: string;
    viewer: UserContext | null;
    video: Video | null;
    code: string;
    readable?: boolean;
  }>([
    { scenario: 'an absent video', viewer: OWNER, video: null, code: ErrorCodes.VIDEO_NOT_FOUND },
    {
      scenario: 'a stranger on a public video',
      viewer: STRANGER,
      video: aVideo(),
      code: ErrorCodes.FORBIDDEN,
      readable: true,
    },
    {
      scenario: 'a stranger on a private video',
      viewer: STRANGER,
      video: aVideo({ visibility: 'private' }),
      code: ErrorCodes.FORBIDDEN,
      readable: false,
    },
    {
      scenario: 'an anonymous caller on a private video',
      viewer: null,
      video: aVideo({ visibility: 'private' }),
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])('refuses $scenario with $code', ({ viewer, video, code, readable }) => {
    const failure = expectErr(decideVideoAnalyticsRead({ viewer, video, videoId: 'video-1' }));

    expect(failure.code).toBe(code);
    if (readable !== undefined) expect(failure).toMatchObject({ readable });
  });
});

describe('@vp/domain-rules: decideChannelAnalyticsRead', () => {
  it('lets a signed-in caller read their own channel', () => {
    expect(expectOk(decideChannelAnalyticsRead(STRANGER))).toBe(STRANGER);
  });

  it.each<{ viewer: UserContext | null; code: string }>([
    { viewer: null, code: ErrorCodes.UNAUTHORIZED },
    { viewer: { id: 'guest-1', role: 'GUEST' }, code: ErrorCodes.FORBIDDEN },
  ])('refuses $viewer with $code', ({ viewer, code }) => {
    expect(expectErr(decideChannelAnalyticsRead(viewer)).code).toBe(code);
  });
});
