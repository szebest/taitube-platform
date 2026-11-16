import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ChannelRole } from '@vp/domain';
import { MS_PER_HOUR } from '@vp/domain/time';
import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { SEEDED } from '@vp/testing';
import { expectErr, expectOk } from '@vp/testing/result';
import { announceStatsUpdated } from '../announce-stats-updated';

const NOW = new Date('2026-03-10T13:42:00.000Z');
const VIDEO_ID = '00000000-0000-7000-8000-0000000000aa';
const MEMBERS: readonly { userId: string; role: ChannelRole }[] = [
  { userId: '00000000-0000-7000-8000-000000000a01', role: 'manager' },
  { userId: '00000000-0000-7000-8000-000000000a02', role: 'editor' },
  { userId: '00000000-0000-7000-8000-000000000a03', role: 'analytics' },
  { userId: '00000000-0000-7000-8000-000000000a04', role: 'moderator' },
];
const OTHER_VIDEO_ID = '00000000-0000-7000-8000-0000000000bb';
const batch = { hourly: [{ videoId: VIDEO_ID, viewHour: '2026-03-10T13:00:00.000Z', views: 1 }] };

describe('housekeeping: announce-stats-updated', () => {
  let repositories: InMemoryRepositories;

  const told = async (userId: string) =>
    expectOk(await repositories.userEvents.listFrom(userId, 0, 10)).map(({ type, payload }) => ({
      type,
      payload,
    }));

  const readyAgo = async (hours: number) => {
    const video = expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: SEEDED.userId,
        sourceKey: 'raw/aa/source.mp4',
      })
    );
    video.readyAt = new Date(NOW.getTime() - hours * MS_PER_HOUR);
  };

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    const channel = expectOk(await repositories.channels.findByUserId(SEEDED.userId));
    for (const { userId, role } of MEMBERS) {
      repositories.channelMembers.join({
        channelId: channel?.id ?? '',
        userId,
        role,
        invitedBy: SEEDED.userId,
        createdAt: NOW,
      });
    }
  });

  it.each([
    ['tells the owner', SEEDED.userId, true],
    ['tells a manager', MEMBERS[0]?.userId ?? '', true],
    ['tells an editor', MEMBERS[1]?.userId ?? '', true],
    ['tells an analytics viewer', MEMBERS[2]?.userId ?? '', true],
    ['does not tell a moderator', MEMBERS[3]?.userId ?? '', false],
  ])('%s about a video in its first hours', async (_who, userId, expected) => {
    await readyAgo(3);

    expectOk(await announceStatsUpdated(repositories, batch, NOW));

    expect(await told(userId)).toEqual(
      expected ? [{ type: 'video.stats.updated', payload: { videoId: VIDEO_ID } }] : []
    );
  });

  it.each([
    ['a video past its first 48 hours', 48],
    ['a video long past it', 500],
  ])('tells nobody about %s', async (_label, hours) => {
    await readyAgo(hours);

    expectOk(await announceStatsUpdated(repositories, batch, NOW));

    expect(await told(SEEDED.userId)).toEqual([]);
  });

  it('reads the videos of the batch in one query', async () => {
    await readyAgo(3);
    const listReadyAfter = vi.spyOn(repositories.videos, 'listReadyAfter');
    const findById = vi.spyOn(repositories.videos, 'findById');
    const twoVideos = {
      hourly: [
        ...batch.hourly,
        { videoId: OTHER_VIDEO_ID, viewHour: '2026-03-10T13:00:00.000Z', views: 1 },
        { videoId: VIDEO_ID, viewHour: '2026-03-10T12:00:00.000Z', views: 1 },
      ],
    };

    expectOk(await announceStatsUpdated(repositories, twoVideos, NOW));

    expect(listReadyAfter).toHaveBeenCalledOnce();
    expect(findById).not.toHaveBeenCalled();
  });

  it('reports a failed event append', async () => {
    await readyAgo(3);
    vi.spyOn(repositories.userEvents, 'append').mockResolvedValue(
      err(databaseUnavailable('append'))
    );

    expectErr(await announceStatsUpdated(repositories, batch, NOW));
  });

  it('tells nobody about a video that is not ready or not known', async () => {
    expectOk(await announceStatsUpdated(repositories, batch, NOW));

    expect(await told(SEEDED.userId)).toEqual([]);
  });
});
