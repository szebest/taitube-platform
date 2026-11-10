import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { isErr, isOk } from '@vp/result';
import { OWNER, STRANGER } from '../../__tests__/entities';
import { decideChannelUserRestriction } from '../restrict-channel-user.rule';

const CHANNEL = { channelId: 'channel-1', ownerId: OWNER.id };
const on = (role: 'moderator' | 'editor' | 'manager'): UserContext => ({
  id: 'member-1',
  role: 'USER',
  memberships: { [CHANNEL.channelId]: { ownerId: OWNER.id, role } },
});

describe('@vp/domain-rules: decideChannelUserRestriction', () => {
  it.each([
    { scenario: 'the owner', actor: OWNER },
    { scenario: 'a moderator of the channel', actor: on('moderator') },
    { scenario: 'a manager of the channel', actor: on('manager') },
  ])('lets $scenario restrict a user off the team', ({ actor }) => {
    const result = decideChannelUserRestriction({
      actor,
      channel: CHANNEL,
      targetUserId: 'viewer-1',
      targetIsMember: false,
    });

    expect(isOk(result) && result.value).toBe('viewer-1');
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    { scenario: 'an editor of the channel', actor: on('editor'), code: ErrorCodes.FORBIDDEN },
  ])('refuses $scenario with $code', ({ actor, code }) => {
    const result = decideChannelUserRestriction({
      actor,
      channel: CHANNEL,
      targetUserId: 'viewer-1',
      targetIsMember: false,
    });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it.each([
    { scenario: 'the owner', targetUserId: OWNER.id, targetIsMember: false },
    { scenario: 'a member', targetUserId: 'member-2', targetIsMember: true },
  ])('refuses to restrict $scenario', ({ targetUserId, targetIsMember }) => {
    const result = decideChannelUserRestriction({
      actor: on('moderator'),
      channel: CHANNEL,
      targetUserId,
      targetIsMember,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.CANNOT_RESTRICT_MEMBER);
  });
});
