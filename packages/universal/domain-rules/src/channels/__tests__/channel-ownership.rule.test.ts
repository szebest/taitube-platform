import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { OWNER, aChannel } from '../../__tests__/entities';
import { decideCreateChannel, decidePromote } from '../channel-ownership.rule';

describe('@vp/domain-rules: decideCreateChannel', () => {
  it('answers the normalised handle while the caller is under the cap', () => {
    expect(
      expectOk(decideCreateChannel({ handle: 'Second', heldBy: null, owned: 1, limit: 5 }))
    ).toBe('second');
  });

  it.each([
    {
      scenario: 'the caller owns the cap',
      input: { handle: 'second', heldBy: null, owned: 5, limit: 5 },
      code: ErrorCodes.CHANNEL_LIMIT_REACHED,
    },
    {
      scenario: 'the caller is at the cap with a taken handle too',
      input: { handle: 'owner', heldBy: aChannel(), owned: 5, limit: 5 },
      code: ErrorCodes.CHANNEL_LIMIT_REACHED,
    },
    {
      scenario: 'another channel holds the handle',
      input: { handle: 'owner', heldBy: aChannel(), owned: 1, limit: 5 },
      code: ErrorCodes.HANDLE_ALREADY_TAKEN,
    },
    {
      scenario: 'the handle is reserved',
      input: { handle: 'admin', heldBy: null, owned: 1, limit: 5 },
      code: ErrorCodes.HANDLE_ALREADY_TAKEN,
    },
    {
      scenario: 'the handle is malformed',
      input: { handle: 'a!', heldBy: null, owned: 1, limit: 5 },
      code: ErrorCodes.INVALID_HANDLE_FORMAT,
    },
  ])('refuses with $code when $scenario', ({ input, code }) => {
    expect(expectErr(decideCreateChannel(input)).code).toBe(code);
  });
});

describe('@vp/domain-rules: decidePromote', () => {
  const channel = aChannel({ id: 'channel-2', isPrimary: false });
  const manager: UserContext = {
    id: 'manager-1',
    role: 'USER',
    memberships: { 'channel-2': { role: 'manager', ownerId: OWNER.id } },
  };

  it('answers the channel when the caller owns it', () => {
    expect(expectOk(decidePromote({ user: OWNER, channelId: channel.id, channel }))).toBe(channel);
  });

  it.each([
    {
      scenario: 'a manager of the channel asks',
      user: manager,
      found: channel,
      code: ErrorCodes.CHANNEL_NOT_OWNED,
    },
    {
      scenario: 'another user asks',
      user: { id: 'stranger-1', role: 'USER' } as UserContext,
      found: channel,
      code: ErrorCodes.CHANNEL_NOT_OWNED,
    },
    {
      scenario: 'the channel is not there',
      user: OWNER,
      found: null,
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
  ])('refuses with $code when $scenario', ({ user, found, code }) => {
    expect(expectErr(decidePromote({ user, channelId: 'channel-2', channel: found })).code).toBe(
      code
    );
  });
});
