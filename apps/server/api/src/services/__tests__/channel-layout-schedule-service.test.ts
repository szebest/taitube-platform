import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { type ActingChannel, type ChannelLayout, standardChannelLayout } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { ChannelLayoutScheduleService } from '../channel-layout-schedule-service';
import { homeWith, section } from './channel-page-fixtures';

const OWNER = '00000000-0000-7000-8000-0000000000a1';
const NOW = Date.parse('2026-12-01T12:00:00.000Z');
const user: UserContext = { id: OWNER, role: 'USER' };

async function setUp() {
  const repositories = new InMemoryRepositories();
  const channel = expectOk(
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
  );
  const acting: ActingChannel = { channelId: channel.id, ownerId: OWNER, role: 'owner' };
  const service = new ChannelLayoutScheduleService({
    layouts: repositories.channelLayouts,
    schedules: repositories.channelLayoutSchedules,
    sources: repositories.channelPageSources,
    images: repositories.channelImages,
    now: () => NOW,
  });
  const publish = async (document: ChannelLayout) =>
    expectOk(
      await repositories.channelLayouts.publish({
        channelId: channel.id,
        document,
        authorUserId: OWNER,
        note: null,
        restoredFromVersion: null,
        audit: null,
      })
    );
  return { repositories, acting, service, publish, channelId: channel.id };
}

describe('ChannelLayoutScheduleService', () => {
  it('brings the earlier layout back when a schedule of the published one comes due', async () => {
    const { repositories, service, acting, publish, channelId } = await setUp();
    const original = standardChannelLayout();
    await publish(original);
    expectOk(
      await service.create(user, acting, {
        publishAt: new Date(NOW + 60_000),
        source: 'published',
      })
    );
    await publish(homeWith(section('seasonal')));

    expectOk(await repositories.channelLayoutSchedules.promoteDue(new Date(NOW + 120_000), 10));

    expect(expectOk(await repositories.channelLayouts.getPublished(channelId))).toMatchObject({
      version: 3,
      document: original,
    });
  });

  it('refuses a time in the past and a source with nothing in it, and cancels once', async () => {
    const { service, acting, publish } = await setUp();
    const later = new Date(NOW + 3_600_000);

    expect(
      expectErr(await service.create(user, acting, { publishAt: new Date(NOW), source: 'draft' }))
        .code
    ).toBe('LAYOUT_SCHEDULE_INVALID');
    expect(
      expectErr(await service.create(user, acting, { publishAt: later, source: 'published' })).code
    ).toBe('REVISION_NOT_FOUND');

    await publish(standardChannelLayout());
    const queued = expectOk(
      await service.create(user, acting, { publishAt: later, source: 'published' })
    );
    expect(expectOk(await service.list(user, acting)).items).toHaveLength(1);
    expect(expectOk(await service.cancel(user, acting, queued.id)).status).toBe('cancelled');
    expect(expectErr(await service.cancel(user, acting, queued.id)).code).toBe(
      'LAYOUT_SCHEDULE_NOT_FOUND'
    );
  });
});
