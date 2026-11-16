import type { ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideVideoStatsRead } from '../read-video-stats.rule';

const memberAs = (role: ChannelRole): UserContext => ({
  id: 'member-1',
  role: 'USER',
  memberships: { 'channel-1': { role, ownerId: OWNER.id } },
});

describe('@vp/domain-rules: decideVideoStatsRead', () => {
  it.each<{ scenario: string; viewer: UserContext }>([
    { scenario: 'the owner', viewer: OWNER },
    { scenario: 'a manager', viewer: memberAs('manager') },
    { scenario: 'an editor', viewer: memberAs('editor') },
    { scenario: 'an analytics viewer', viewer: memberAs('analytics') },
  ])('lets $scenario read the stats of a private video', ({ viewer }) => {
    const video = aVideo({ visibility: 'private' });

    expect(expectOk(decideVideoStatsRead({ viewer, video, videoId: video.id }))).toBe(video);
  });

  it.each<{
    scenario: string;
    viewer: UserContext | null;
    video: ReturnType<typeof aVideo> | null;
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
      scenario: 'a moderator of the channel on a public video',
      viewer: memberAs('moderator'),
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
  ])('refuses $scenario with $code', ({ viewer, video, code, readable }) => {
    const failure = expectErr(decideVideoStatsRead({ viewer, video, videoId: 'video-1' }));

    expect(failure.code).toBe(code);
    if (readable !== undefined) expect(failure).toMatchObject({ readable });
  });
});
