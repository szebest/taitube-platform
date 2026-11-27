import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideVideoEditAccess } from '../edit-access.rule';

const video = aVideo();
const memberOf = (role: 'editor' | 'moderator'): UserContext => ({
  id: `${role}-1`,
  role: 'USER',
  memberships: { 'channel-1': { role, ownerId: OWNER.id } },
});

describe('@vp/domain-rules: decideVideoEditAccess', () => {
  it.each([
    { name: 'the owner', editor: OWNER },
    { name: 'an admin', editor: ADMIN },
    { name: 'a channel editor', editor: memberOf('editor') },
  ])('lets $name through and hands the video back', ({ editor }) => {
    expect(expectOk(decideVideoEditAccess({ editor, video, videoId: video.id }))).toBe(video);
  });

  it.each([
    {
      name: 'a channel moderator',
      editor: memberOf('moderator'),
      v: video,
      code: ErrorCodes.FORBIDDEN,
    },
    {
      name: 'a stranger of a public video',
      editor: STRANGER,
      v: video,
      code: ErrorCodes.FORBIDDEN,
    },
    { name: 'a missing video', editor: OWNER, v: null, code: ErrorCodes.VIDEO_NOT_FOUND },
    {
      name: 'a deleted video',
      editor: OWNER,
      v: aVideo({ status: 'DELETED' }),
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    { name: 'nobody signed in', editor: null, v: video, code: ErrorCodes.FORBIDDEN },
  ])('refuses $name', ({ editor, v, code }) => {
    expect(expectErr(decideVideoEditAccess({ editor, video: v, videoId: 'video-1' })).code).toBe(
      code
    );
  });

  it('keeps a private video the editor cannot see unreadable, so the edge can disguise it', () => {
    const failure = expectErr(
      decideVideoEditAccess({
        editor: STRANGER,
        video: aVideo({ visibility: 'private' }),
        videoId: 'video-1',
      })
    );

    expect(failure).toMatchObject({ code: ErrorCodes.FORBIDDEN, readable: false });
  });
});
