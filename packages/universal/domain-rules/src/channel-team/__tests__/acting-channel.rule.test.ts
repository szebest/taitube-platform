import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideActingChannel } from '../acting-channel.rule';

const PRIMARY = '00000000-0000-7000-8000-0000000000c1';
const SECOND = '00000000-0000-7000-8000-0000000000c2';
const TEAM = '00000000-0000-7000-8000-0000000000c3';
const OTHER = '00000000-0000-7000-8000-0000000000c4';
const OWNED = { primaryId: PRIMARY, ownedIds: [PRIMARY, SECOND] };

const member: UserContext = {
  id: 'user-1',
  role: 'USER',
  memberships: { [TEAM]: { role: 'editor', ownerId: 'owner-2' } },
};

describe('@vp/domain-rules: decideActingChannel', () => {
  it.each([
    { scenario: 'names no channel', requested: undefined, channelId: PRIMARY },
    { scenario: 'names their primary', requested: PRIMARY, channelId: PRIMARY },
    { scenario: 'names another channel they own', requested: SECOND, channelId: SECOND },
  ])('acts as the owner when the caller $scenario', ({ requested, channelId }) => {
    expect(expectOk(decideActingChannel({ user: member, owned: OWNED, requested }))).toEqual({
      channelId,
      ownerId: member.id,
      role: 'owner',
    });
  });

  it('acts with the role the caller holds on a channel whose team they are on', () => {
    expect(expectOk(decideActingChannel({ user: member, owned: OWNED, requested: TEAM }))).toEqual({
      channelId: TEAM,
      ownerId: 'owner-2',
      role: 'editor',
    });
  });

  it.each([
    { scenario: 'a channel the caller has no relation to', requested: OTHER },
    { scenario: 'a value that is no channel id', requested: 'not-a-uuid' },
    { scenario: 'an empty value', requested: '' },
  ])('refuses $scenario', ({ requested }) => {
    expect(expectErr(decideActingChannel({ user: member, owned: OWNED, requested }))).toMatchObject(
      { code: ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED, channelId: requested }
    );
  });
});
