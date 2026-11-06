import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { aLiveStream, MODERATOR, OWNER, STRANGER } from '../../__tests__/entities';
import { decideLiveChatModerate, decideLiveChatPost, type LiveChatPostInput } from '../chat.rule';

const LIVE = aLiveStream({ status: 'LIVE', chatSlowModeSeconds: 30, chatSubscribersOnly: true });

function post(overrides: Partial<LiveChatPostInput> = {}): LiveChatPostInput {
  return { actor: STRANGER, stream: LIVE, ownerId: OWNER.id, isSubscriber: true, ...overrides };
}

describe('@vp/domain-rules: decideLiveChatPost', () => {
  it.each<{ who: string; actor: UserContext; isSubscriber: boolean; slowModeSeconds: number }>([
    { who: 'a subscriber', actor: STRANGER, isSubscriber: true, slowModeSeconds: 30 },
    { who: 'the owner', actor: OWNER, isSubscriber: false, slowModeSeconds: 0 },
    { who: 'a moderator', actor: MODERATOR, isSubscriber: false, slowModeSeconds: 0 },
  ])('lets $who post, waiting $slowModeSeconds s', ({ actor, isSubscriber, slowModeSeconds }) => {
    expect(expectOk(decideLiveChatPost(post({ actor, isSubscriber })))).toEqual({
      slowModeSeconds,
    });
  });

  it.each([
    {
      scenario: 'a stream that is not live',
      overrides: { actor: OWNER, stream: aLiveStream({ status: 'ENDED' }) },
      code: ErrorCodes.LIVE_CHAT_CLOSED,
    },
    {
      scenario: 'a viewer who does not subscribe, in subscribers-only',
      overrides: { isSubscriber: false },
      code: ErrorCodes.LIVE_CHAT_SUBSCRIBERS_ONLY,
    },
  ])('refuses $scenario', ({ overrides, code }) => {
    expect(expectErr(decideLiveChatPost(post(overrides))).code).toBe(code);
  });
});

describe('@vp/domain-rules: decideLiveChatModerate', () => {
  const moderate = (actor: UserContext | null) =>
    decideLiveChatModerate({ actor, stream: LIVE, ownerId: OWNER.id });

  it.each([
    { who: 'the owner', actor: OWNER },
    { who: 'a moderator', actor: MODERATOR },
  ])('lets $who moderate', ({ actor }) => {
    expect(expectOk(moderate(actor)).id).toBe(LIVE.id);
  });

  it.each([
    { who: 'a viewer', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    { who: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
  ])('refuses $who with $code', ({ actor, code }) => {
    expect(expectErr(moderate(actor)).code).toBe(code);
  });
});
