import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedTeamMember } from '../../__tests__/test-app';
import { ChannelService } from '../channel-service';
import { RequestIdentity } from '../request-identity';
import { channelServiceDeps } from './service-deps';

const OWNER = { id: '00000000-0000-7000-8000-0000000000d1', role: 'USER' } as const;
const MEMBER = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' } as const;

function identityOver(repositories: InMemoryRepositories) {
  return new RequestIdentity({
    channels: new ChannelService(channelServiceDeps(repositories)),
    members: repositories.channelMembers,
  });
}

describe('RequestIdentity', () => {
  it('provisions a first-time caller and acts on their own channel', async () => {
    const repositories = new InMemoryRepositories();

    const { user, acting } = expectOk(await identityOver(repositories).resolve(OWNER));

    const own = expectOk(await repositories.channels.findByUserId(OWNER.id));
    expect(user.memberships).toEqual({});
    expect(expectOk(acting)).toEqual({ channelId: own?.id, ownerId: OWNER.id, role: 'owner' });
  });

  it('reads the memberships from the store on every call', async () => {
    const repositories = new InMemoryRepositories();
    const identity = identityOver(repositories);
    const channelId = await seedTeamMember(repositories, {
      ownerId: OWNER.id,
      memberId: MEMBER.id,
      role: 'analytics',
    });

    const { user, acting } = expectOk(await identity.resolve(MEMBER, channelId));
    expect(user.memberships).toEqual({ [channelId]: { role: 'analytics', ownerId: OWNER.id } });
    expect(expectOk(acting)).toEqual({ channelId, ownerId: OWNER.id, role: 'analytics' });

    repositories.channelMembers.clear();
    const stale = expectOk(await identity.resolve(MEMBER, channelId));
    expect(stale.user.memberships).toEqual({});
    expect(expectErr(stale.acting).code).toBe(ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED);
  });
});
