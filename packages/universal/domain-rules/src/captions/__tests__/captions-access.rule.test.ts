import type { Video } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, aVideo, OWNER, STRANGER } from '../../__tests__/entities';
import { publicReadFailure } from '../../videos/index';
import { decideCaptionsManage, decideCaptionsRead } from '../captions-access.rule';

const access = (viewer: UserContext | null, video: Video | null) => ({
  viewer,
  video,
  videoId: 'video-1',
});

describe('@vp/domain-rules: decideCaptionsRead', () => {
  it.each([
    { who: 'an anonymous viewer', viewer: null, manager: false },
    { who: 'a stranger', viewer: STRANGER, manager: false },
    { who: 'the owner', viewer: OWNER, manager: true },
    { who: 'an admin', viewer: ADMIN, manager: true },
  ])('lets $who read a public video captions, managing: $manager', ({ viewer, manager }) => {
    expect(expectOk(decideCaptionsRead(access(viewer, aVideo()))).manager).toBe(manager);
  });

  it.each([
    { who: 'a stranger', viewer: STRANGER, code: ErrorCodes.FORBIDDEN },
    { who: 'an anonymous viewer', viewer: null, code: ErrorCodes.UNAUTHORIZED },
  ])('answers $who on a private video with $code', ({ viewer, code }) => {
    const refused = expectErr(
      decideCaptionsRead(access(viewer, aVideo({ visibility: 'private' })))
    );

    expect(refused.code).toBe(code);
  });

  it('is disguised as a missing video for a stranger on a private one', () => {
    const refused = expectErr(
      decideCaptionsRead(access(STRANGER, aVideo({ visibility: 'private' })))
    );

    expect(publicReadFailure(refused).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it.each([
    { name: 'an absent video', video: null },
    { name: 'a deleted video', video: aVideo({ status: 'DELETED' }) },
  ])('reports $name as VIDEO_NOT_FOUND, even to its owner', ({ video }) => {
    expect(expectErr(decideCaptionsRead(access(OWNER, video))).code).toBe(
      ErrorCodes.VIDEO_NOT_FOUND
    );
  });
});

describe('@vp/domain-rules: decideCaptionsManage', () => {
  it.each([
    { who: 'the owner', viewer: OWNER },
    { who: 'an admin', viewer: ADMIN },
  ])('lets $who change the captions', ({ viewer }) => {
    expect(expectOk(decideCaptionsManage(access(viewer, aVideo()))).id).toBe('video-1');
  });

  it('refuses a stranger on a video they can see with a 403 that stays one', () => {
    const refused = expectErr(decideCaptionsManage(access(STRANGER, aVideo())));

    expect(publicReadFailure(refused).code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('hides a private video from a stranger behind VIDEO_NOT_FOUND', () => {
    const refused = expectErr(
      decideCaptionsManage(access(STRANGER, aVideo({ visibility: 'private' })))
    );

    expect(publicReadFailure(refused).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });
});
