import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { ADMIN, OWNER, STRANGER, aPost } from '../../__tests__/entities';
import { decidePostReact, decidePostTarget, decidePostWrite } from '../manage-post.rule';

const channel = { id: 'channel-1', ownerId: OWNER.id };

function member(role: 'editor' | 'moderator'): UserContext {
  return {
    id: `${role}-1`,
    role: 'USER',
    memberships: { [channel.id]: { role, ownerId: channel.ownerId } },
  };
}

const ACTIONS = ['create', 'update', 'delete'] as const;

describe('@vp/domain-rules: decidePostWrite', () => {
  it.each(
    ACTIONS.flatMap((action) => [
      { who: 'the owner', actor: OWNER, action },
      { who: 'an editor', actor: member('editor'), action },
      { who: 'a site admin', actor: ADMIN, action },
    ])
  )('lets $who $action a post', ({ actor, action }) => {
    const result = decidePostWrite({ actor, action, channel });

    expect(isOk(result) && result.value).toBe(actor);
  });

  it.each(
    ACTIONS.flatMap((action) => [
      { who: 'a stranger', actor: STRANGER, action },
      { who: 'a moderator', actor: member('moderator'), action },
    ])
  )('forbids $who to $action a post', ({ actor, action }) => {
    const result = decidePostWrite({ actor, action, channel });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.FORBIDDEN,
      action,
      subject: 'Post',
      userId: actor.id,
    });
  });

  it.each(ACTIONS)('asks an anonymous caller to sign in to %s a post', (action) => {
    const result = decidePostWrite({ actor: null, action, channel });

    expect(isErr(result) && result.error).toMatchObject({ code: ErrorCodes.UNAUTHORIZED, action });
  });
});

describe('@vp/domain-rules: decidePostTarget', () => {
  it('returns a post of the channel, whatever its status', () => {
    const post = aPost({ status: 'draft' });

    const result = decidePostTarget({ post, postId: post.id, channelId: 'channel-1' });

    expect(isOk(result) && result.value).toBe(post);
  });

  it.each([
    { scenario: 'a post of another channel', post: aPost({ channelId: 'channel-2' }) },
    { scenario: 'no post', post: null },
  ])('reports $scenario as not found', ({ post }) => {
    const result = decidePostTarget({ post, postId: 'post-1', channelId: 'channel-1' });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.POST_NOT_FOUND,
      postId: 'post-1',
    });
  });
});

describe('@vp/domain-rules: decidePostReact', () => {
  it.each<{ scenario: string; reactor: UserContext | null; code: string | null }>([
    { scenario: 'a signed-in user', reactor: STRANGER, code: null },
    {
      scenario: 'a guest identity',
      reactor: { id: 'guest-1', role: 'GUEST' },
      code: ErrorCodes.FORBIDDEN,
    },
    { scenario: 'an anonymous caller', reactor: null, code: ErrorCodes.UNAUTHORIZED },
  ])('decides a like by $scenario', ({ reactor, code }) => {
    const result = decidePostReact(reactor);

    expect(isErr(result) ? result.error.code : null).toBe(code);
  });
});
