import { err, ok } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideVideoGate } from '../video-gate.rule';

const GUARDED = aVideo({ visibility: 'unlisted', passwordProtected: true });
const SHARE = { targetType: 'video', targetId: GUARDED.id } as const;
const EDITOR: UserContext = {
  id: 'editor-1',
  role: 'USER',
  memberships: { 'channel-1': { role: 'editor', ownerId: OWNER.id } },
};
const MODERATOR: UserContext = { id: 'mod-1', role: 'MODERATOR' };

describe('@vp/domain-rules: decideVideoGate', () => {
  it.each([
    { name: 'an anonymous viewer', viewer: null },
    { name: 'a signed-in stranger', viewer: STRANGER },
    { name: 'a platform moderator', viewer: MODERATOR },
  ])('stops $name without the credential or a link', ({ viewer }) => {
    expect(decideVideoGate({ viewer, video: GUARDED, unlocked: false, share: null })).toMatchObject(
      err({ code: ErrorCodes.VIDEO_PASSWORD_REQUIRED, videoId: GUARDED.id })
    );
  });

  it.each([
    { name: 'the unlock credential', viewer: null, unlocked: true, share: null },
    { name: 'a live share link', viewer: null, unlocked: false, share: SHARE },
    { name: 'the owner', viewer: OWNER, unlocked: false, share: null },
    { name: 'a channel editor', viewer: EDITOR, unlocked: false, share: null },
    { name: 'an admin', viewer: ADMIN, unlocked: false, share: null },
  ])('lets $name through', ({ viewer, unlocked, share }) => {
    expect(decideVideoGate({ viewer, video: GUARDED, unlocked, share })).toEqual(ok(GUARDED));
  });

  it.each([
    { name: 'without a password', video: aVideo({ visibility: 'unlisted' }) },
    { name: 'made public since', video: aVideo({ visibility: 'public', passwordProtected: true }) },
  ])('does not guard a video $name', ({ video }) => {
    expect(decideVideoGate({ viewer: null, video, unlocked: false, share: null })).toEqual(
      ok(video)
    );
  });
});
