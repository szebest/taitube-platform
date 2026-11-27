import { ok } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ChannelPageView } from '@vp/api-contracts';
import type { ActingChannel } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { ChannelPageService } from '../channel-page/channel-page-service';

const OWNER = '00000000-0000-7000-8000-0000000000a1';
const FAN = '00000000-0000-7000-8000-0000000000a2';
const PAGE = { locales: ['en'] } as const;
const VIEW = { channelId: 'c', tab: { slug: 'home' } } as unknown as ChannelPageView;

describe('ChannelPageService', () => {
  it.each([
    { scenario: 'a guest', viewer: null, follows: false, audience: 'guest' },
    {
      scenario: 'a signed-in viewer who does not follow',
      viewer: FAN,
      follows: false,
      audience: 'member',
    },
    { scenario: 'a follower', viewer: FAN, follows: true, audience: 'subscriber' },
  ])('resolves the page for $scenario as $audience', async ({ viewer, follows, audience }) => {
    const repositories = new InMemoryRepositories();
    const channel = expectOk(
      await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
    );
    const resolve = vi.fn(async () => ok(VIEW));
    const service = new ChannelPageService({
      channels: repositories.channels,
      layouts: repositories.channelLayouts,
      subscriptions: {
        getUserSubscriptionChannelIds: async () => ok(follows ? [channel.id] : []),
      },
      resolver: { resolve },
    });
    const user: UserContext | null = viewer ? { id: viewer, role: 'USER' } : null;

    expectOk(await service.get(user, 'owner', PAGE));

    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ audience, revision: null }));
  });

  it('refuses a preview to a member the page task is closed to', async () => {
    const repositories = new InMemoryRepositories();
    const service = new ChannelPageService({
      channels: repositories.channels,
      layouts: repositories.channelLayouts,
      subscriptions: { getUserSubscriptionChannelIds: async () => ok([]) },
      resolver: { resolve: vi.fn() },
    });
    const acting: ActingChannel = { channelId: 'c', ownerId: OWNER, role: 'moderator' };

    const failure = expectErr(
      await service.preview({ id: FAN, role: 'USER' }, acting, 'visitor', PAGE)
    );

    expect(failure.code).toBe('FORBIDDEN');
  });
});
