import { Paginator } from '@kit/pagination';
import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { type ActingChannel, type ChannelLayout, standardChannelLayout } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { ChannelLayoutService } from '../channel-layout-service';

const OWNER = '00000000-0000-7000-8000-0000000000a1';
const user: UserContext = { id: OWNER, role: 'USER' };

async function setUp() {
  const repositories = new InMemoryRepositories();
  const channel = expectOk(
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
  );
  const acting: ActingChannel = { channelId: channel.id, ownerId: OWNER, role: 'owner' };
  const service = new ChannelLayoutService({
    layouts: repositories.channelLayouts,
    revisions: repositories.entityRevisions,
    sources: repositories.channelPageSources,
    images: repositories.channelImages,
    paginator: new Paginator({ defaultLimit: 20, maxLimit: 50 }),
  });
  const auditActions = async () =>
    expectOk(await repositories.channelAudit.list(channel.id, { cursor: null, limit: 50 })).map(
      ({ action }) => action
    );
  const publish = async (document: ChannelLayout, version: number) => {
    expectOk(await service.saveDraft(user, acting, { document, version }));
    return expectOk(await service.publish(user, acting, { version: version + 1 }));
  };
  return { repositories, acting, service, auditActions, publish };
}

describe('ChannelLayoutService', () => {
  it('audits a save, a publish and a restore, and keeps the earlier revision to go back to', async () => {
    const { service, acting, auditActions, publish } = await setUp();
    expect((await publish(standardChannelLayout(), 0)).version).toBe(1);
    await publish(standardChannelLayout(), 1);
    const { items } = expectOk(await service.listRevisions(user, acting, {}));
    const first = items.find(({ version }) => version === 1);

    const restored = expectOk(await service.restore(user, acting, first?.id ?? ''));

    expect(restored).toMatchObject({ version: 3, restoredFromVersion: 1 });
    expect((await auditActions()).sort()).toEqual([
      'page.draft_saved',
      'page.draft_saved',
      'page.published',
      'page.published',
      'page.restored',
    ]);
  });
});
