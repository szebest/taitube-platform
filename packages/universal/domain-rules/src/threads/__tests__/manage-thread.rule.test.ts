import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { AUTHOR, OWNER, STRANGER, aThread, aVideo } from '../../__tests__/entities';
import { decideThreadPin, decideThreadRemove } from '../manage-thread.rule';

const asMember = (role: 'editor' | 'moderator' | 'analytics'): UserContext => ({
  id: `member-${role}`,
  role: 'USER',
  memberships: { 'channel-1': { role, ownerId: OWNER.id } },
});

const input = (actor: UserContext | null, thread = aThread()) => ({
  actor,
  thread,
  threadId: 'thread-1',
  video: aVideo(),
});

describe('@vp/domain-rules: decideThreadPin', () => {
  it.each([
    { name: 'the owner', actor: OWNER },
    { name: 'an editor', actor: asMember('editor') },
  ])('lets $name pin', ({ actor }) => {
    expect(isOk(decideThreadPin(input(actor)))).toBe(true);
  });

  it.each([
    { name: 'nobody signed in', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { name: 'a viewer', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    { name: 'a moderator', actor: asMember('moderator'), code: ErrorCodes.FORBIDDEN },
  ])('refuses $name', ({ actor, code }) => {
    const result = decideThreadPin(input(actor));

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('finds no thread that is not there', () => {
    const result = decideThreadPin({ ...input(OWNER), thread: null });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.THREAD_NOT_FOUND);
  });
});

describe('@vp/domain-rules: decideThreadRemove', () => {
  it.each([
    { name: 'its author', actor: AUTHOR },
    { name: 'the owner', actor: OWNER },
    { name: 'a moderator of the channel', actor: asMember('moderator') },
  ])('lets $name remove', ({ actor }) => {
    expect(isOk(decideThreadRemove(input(actor)))).toBe(true);
  });

  it.each([
    { name: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    { name: 'an editor', actor: asMember('editor'), code: ErrorCodes.FORBIDDEN },
    { name: 'nobody signed in', actor: null, code: ErrorCodes.UNAUTHORIZED },
  ])('refuses $name', ({ actor, code }) => {
    const result = decideThreadRemove(input(actor));

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
