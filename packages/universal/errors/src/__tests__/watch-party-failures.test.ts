import { ErrorCodes } from '../error-codes';
import {
  watchPartyFull,
  watchPartyPasswordLocked,
  watchPartyPermissionMissing,
  watchPartyStateStale,
  watchPartyVideoNotShareable,
} from '../watch-party-failures';

describe('@vp/errors: watch party failures', () => {
  it.each([
    {
      failure: watchPartyFull('room-1', 10, 10),
      expected: { code: ErrorCodes.WATCH_PARTY_FULL, present: 10, capacity: 10 },
    },
    {
      failure: watchPartyPasswordLocked(900),
      expected: { code: ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED, retryAfterSeconds: 900 },
    },
    {
      failure: watchPartyStateStale(7, 3),
      expected: { code: ErrorCodes.WATCH_PARTY_STATE_STALE, playbackVersion: 7, rolesVersion: 3 },
    },
    {
      failure: watchPartyVideoNotShareable('video-1', 'private'),
      expected: { code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE, reason: 'private' },
    },
  ])('carries what the edge answers $expected.code with', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });

  it('names the missing permission in the message the Problem detail carries', () => {
    expect(watchPartyPermissionMissing('chat.post')).toMatchObject({
      permission: 'chat.post',
      message: 'Missing the chat.post permission',
    });
  });
});
