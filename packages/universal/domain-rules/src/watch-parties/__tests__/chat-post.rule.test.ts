import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideWatchPartyChatPost } from '../chat-post.rule';
import { type Holder, ROOM_ID, seatOf } from './room-fixtures';

function postOf(holder: Holder, chatEnabled = true) {
  return decideWatchPartyChatPost({
    room: { id: ROOM_ID, chatEnabled, slowModeSeconds: 30 },
    ability: seatOf(holder).ability,
  });
}

describe('@vp/domain-rules: decideWatchPartyChatPost', () => {
  it.each([
    { who: 'a member', holder: 'member' as const, slowModeSeconds: 30 },
    { who: 'a VIP past slow mode', holder: 'vip' as const, slowModeSeconds: 0 },
  ])('lets $who post, waiting $slowModeSeconds s', ({ holder, slowModeSeconds }) => {
    expect(expectOk(postOf(holder))).toEqual({ slowModeSeconds });
  });

  it.each([
    {
      who: 'the owner with chat off',
      holder: 'owner' as const,
      enabled: false,
      code: ErrorCodes.WATCH_PARTY_CHAT_OFF,
    },
    {
      who: 'a guest',
      holder: 'guest' as const,
      enabled: true,
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      who: 'a chat-muted member',
      holder: 'chat_muted' as const,
      enabled: true,
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
  ])('refuses $who', ({ holder, enabled, code }) => {
    expect(expectErr(postOf(holder, enabled)).code).toBe(code);
  });
});
