import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
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

    const own = expectOk(await repositories.channels.findPrimaryByUserId(OWNER.id));
    expect(user.memberships).toEqual({});
    expect(user.channels).toEqual({ primaryId: own?.id, ownedIds: [own?.id] });
    expect(expectOk(acting)).toEqual({ channelId: own?.id, ownerId: OWNER.id, role: 'owner' });
  });

  it('acts as another owned channel the header names, and refuses one the caller has no tie to', async () => {
    const repositories = new InMemoryRepositories();
    const identity = identityOver(repositories);
    expectOk(await identity.resolve(OWNER));
    const second = expectOk(
      await repositories.channels.createOwned(
        { userId: OWNER.id, handle: 'second', displayName: 'Second' },
        5
      )
    );

    const named = expectOk(await identity.resolve(OWNER, second.id));
    const stranger = expectOk(await identity.resolve(MEMBER, second.id));

    expect(expectOk(named.acting)).toEqual({
      channelId: second.id,
      ownerId: OWNER.id,
      role: 'owner',
    });
    expect(expectErr(stranger.acting).code).toBe(ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED);
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
