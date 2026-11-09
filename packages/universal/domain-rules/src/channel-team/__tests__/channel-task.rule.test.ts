import type { ActingChannel, ActingRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { type ChannelTaskInput, decideChannelTask } from '../channel-task.rule';

const OWNER_ID = 'owner-1';
const CHANNEL_ID = 'chan-1';

function actingAs(role: ActingRole): { user: UserContext; acting: ActingChannel } {
  const acting = { channelId: CHANNEL_ID, ownerId: OWNER_ID, role };
  if (role === 'owner') return { user: { id: OWNER_ID, role: 'USER' }, acting };
  return {
    user: {
      id: `${role}-1`,
      role: 'USER',
      memberships: { [CHANNEL_ID]: { role, ownerId: OWNER_ID } },
    },
    acting,
  };
}

describe('@vp/domain-rules: decideChannelTask', () => {
  it.each<[ChannelTaskInput['task'], ActingRole[]]>([
    ['read-analytics', ['owner', 'manager', 'editor', 'analytics']],
    ['read-library', ['owner', 'manager', 'editor']],
    ['read-inbox', ['owner', 'manager', 'moderator']],
    ['edit-channel', ['owner', 'manager', 'editor']],
    ['pin-content', ['owner', 'manager', 'editor']],
    ['upload', ['owner', 'manager', 'editor']],
    ['read-team', ['owner', 'manager']],
    ['read-audit', ['owner', 'manager']],
  ])('%s is open to %j and refused to the rest', (task, allowed) => {
    const verdicts = (['owner', 'manager', 'editor', 'moderator', 'analytics'] as const).filter(
      (role) => decideChannelTask({ ...actingAs(role), task }).ok
    );

    expect(verdicts).toEqual(allowed);
  });

  it('answers the acting channel it decided on', () => {
    const { user, acting } = actingAs('editor');

    expect(expectOk(decideChannelTask({ user, acting, task: 'upload' }))).toBe(acting);
  });

  it('refuses an anonymous caller as unauthorized', () => {
    const { acting } = actingAs('owner');

    expect(expectErr(decideChannelTask({ user: null, acting, task: 'read-library' })).code).toBe(
      ErrorCodes.UNAUTHORIZED
    );
  });
});
