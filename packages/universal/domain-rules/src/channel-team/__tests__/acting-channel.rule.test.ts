import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideActingChannel } from '../acting-channel.rule';

const OWN = { id: 'chan-own' };

const member: UserContext = {
  id: 'user-1',
  role: 'USER',
  memberships: { 'chan-team': { role: 'editor', ownerId: 'owner-2' } },
};

describe('@vp/domain-rules: decideActingChannel', () => {
  it.each([
    { scenario: 'names no channel', requested: undefined },
    { scenario: 'names their own', requested: OWN.id },
  ])('acts as the owner of their own channel when the caller $scenario', ({ requested }) => {
    expect(expectOk(decideActingChannel({ user: member, own: OWN, requested }))).toEqual({
      channelId: OWN.id,
      ownerId: member.id,
      role: 'owner',
    });
  });

  it('acts with the role the caller holds on a channel whose team they are on', () => {
    expect(
      expectOk(decideActingChannel({ user: member, own: OWN, requested: 'chan-team' }))
    ).toEqual({
      channelId: 'chan-team',
      ownerId: 'owner-2',
      role: 'editor',
    });
  });

  it('refuses a channel the caller is not on', () => {
    expect(
      expectErr(decideActingChannel({ user: member, own: OWN, requested: 'chan-other' }))
    ).toMatchObject({ code: ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED, channelId: 'chan-other' });
  });
});
