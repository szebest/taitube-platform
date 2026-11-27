import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import type { ExportRowRepositoryPort, ExportScope, Repositories } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { seedTeam } from './channel-team-fixtures';
import { describeExportPostRowsContract } from './export-post-rows.contract';
import { walk } from './export-row-walk';
import {
  CATEGORY_MUSIC_ID,
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_ID,
  publicVideo,
  seedCategories,
  seedOwners,
  VIDEO_IDS,
  videoTarget,
  OWNER_CHANNEL_ID,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const COMMENT = (n: number) => `00000000-0000-7000-8000-00000000ec${String(n).padStart(2, '0')}`;
const BASE = Date.parse('2026-03-01T12:00:00.000Z');

async function view(repositories: Repositories, videoId: string, viewDate: string, views: number) {
  expectOk(
    await repositories.videoViews.applyBatch({
      batchId: randomUUID(),
      counts: [{ videoId, viewDate, views, watchSeconds: views * 10 }],
      retention: [
        { videoId, percent: 0, viewers: views },
        { videoId, percent: 50, viewers: 1 },
      ],
      hourly: [],
      devices: [],
      shareLinks: [],
      experiments: [],
    })
  );
}

export function describeExportRowRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ExportRowRepository contract', () => {
    let subject: RepositoriesSubject;
    let rows: ExportRowRepositoryPort;
    let channel: Channel;
    let scope: ExportScope;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      const { repositories } = subject;
      await seedOwners(repositories);
      await seedCategories(repositories);
      channel = await seedTeam(repositories);
      scope = { channelId: channel.id, ownerId: OWNER_ID, range: {} };
      rows = repositories.exportRows;
      await subject.seedVideo(
        publicVideo({
          id: VIDEO_IDS.a,
          title: 'First',
          tags: ['a', 'b'],
          categoryId: CATEGORY_MUSIC_ID,
        }),
        new Date(BASE)
      );
      await subject.seedVideo(
        publicVideo({ id: VIDEO_IDS.b, title: 'Second' }),
        new Date(BASE + 1000)
      );
      await subject.seedVideo(
        publicVideo({ id: VIDEO_IDS.c, title: 'Theirs', ownerId: OTHER_OWNER_ID }),
        new Date(BASE + 2000)
      );
    });

    it('reads every daily row of the channel videos, then their retention steps', async () => {
      await view(subject.repositories, VIDEO_IDS.a, '2026-03-02', 3);
      await view(subject.repositories, VIDEO_IDS.a, '2026-03-03', 1);
      await view(subject.repositories, VIDEO_IDS.c, '2026-03-02', 9);

      const read = await walk(rows.videoAnalytics.bind(rows), scope);

      expect(
        read.map(({ series, day, views, percent, viewers }) => ({
          series,
          day,
          views,
          percent,
          viewers,
        }))
      ).toEqual([
        { series: 'daily', day: '2026-03-02', views: 3, percent: null, viewers: null },
        { series: 'daily', day: '2026-03-03', views: 1, percent: null, viewers: null },
        { series: 'retention', day: null, views: null, percent: 0, viewers: 4 },
        { series: 'retention', day: null, views: null, percent: 50, viewers: 2 },
      ]);
      expect(new Set(read.map(({ title }) => title))).toEqual(new Set(['First']));
    });

    it('narrows the daily rows to the range and keeps the curve whole', async () => {
      await view(subject.repositories, VIDEO_IDS.a, '2026-03-02', 3);
      await view(subject.repositories, VIDEO_IDS.a, '2026-03-03', 1);

      const read = await walk(rows.videoAnalytics.bind(rows), {
        ...scope,
        range: { from: '2026-03-03', to: '2026-03-03' },
      });

      expect(read.map(({ series, day }) => [series, day])).toEqual([
        ['daily', '2026-03-03'],
        ['retention', null],
        ['retention', null],
      ]);
    });

    it('reads one row per channel day with views or subscriber changes', async () => {
      await view(subject.repositories, VIDEO_IDS.a, '2026-03-02', 3);
      await view(subject.repositories, VIDEO_IDS.b, '2026-03-02', 2);
      await view(subject.repositories, VIDEO_IDS.c, '2026-03-04', 9);
      const { subscriptions } = subject.repositories;
      expectOk(await subscriptions.subscribe(OTHER_OWNER_ID, OTHER_OWNER_CHANNEL_ID, channel.id));
      expectOk(await subscriptions.unsubscribe(OTHER_OWNER_CHANNEL_ID, channel.id));

      const read = await walk(rows.channelAnalytics.bind(rows), scope);
      const today = new Date().toISOString().slice(0, 10);

      expect(read).toEqual([
        { day: '2026-03-02', views: 5, watchSeconds: 50, subscribersGained: 0, subscribersLost: 0 },
        { day: today, views: 0, watchSeconds: 0, subscribersGained: 1, subscribersLost: 1 },
      ]);
    });

    it('reads the comments by public identity, held ones included and removed ones not', async () => {
      const { repositories } = subject;
      const fan = expectOk(await repositories.channels.findById(OTHER_OWNER_CHANNEL_ID));
      if (!fan) throw new Error('seedOwners made no channel for the other owner');
      for (const n of [1, 2, 3]) {
        expectOk(
          await repositories.comments.create({
            id: COMMENT(n),
            target: videoTarget(VIDEO_IDS.a),
            channelId: OWNER_CHANNEL_ID,
            authorId: fan.userId,
            authorChannelId: fan.id,
            parentId: n === 2 ? COMMENT(1) : null,
            content: `=cmd ${n}`,
          })
        );
        await subject.adjustComment(COMMENT(n), { createdAt: new Date(BASE + n * 1000) });
      }
      await subject.adjustComment(COMMENT(2), {
        moderationState: 'held',
        moderationDisclosure: 'silent',
      });
      expectOk(
        await repositories.comments.remove({ id: COMMENT(3), target: videoTarget(VIDEO_IDS.a) })
      );

      const read = await walk(rows.comments.bind(rows), scope);

      expect(read).toEqual([
        expect.objectContaining({
          commentId: COMMENT(1),
          videoTitle: 'First',
          parentId: null,
          authorHandle: 'other',
          authorDisplayName: 'Other',
          text: '=cmd 1',
          createdAt: new Date(BASE + 1000).toISOString(),
          hearted: false,
          pinned: false,
          moderationState: 'published',
        }),
        expect.objectContaining({
          commentId: COMMENT(2),
          parentId: COMMENT(1),
          moderationState: 'held',
          disclosure: 'silent',
        }),
      ]);
      expect(Object.keys(read[0] ?? {}).filter((key) => /email|authorId/i.test(key))).toEqual([]);
    });

    it('reads the channel videos oldest first with their metadata, category and counts', async () => {
      const read = await walk(rows.videos.bind(rows), scope);

      expect(
        read.map(({ videoId, title, tags, category, visibility }) => ({
          videoId,
          title,
          tags,
          category,
          visibility,
        }))
      ).toEqual([
        {
          videoId: VIDEO_IDS.a,
          title: 'First',
          tags: ['a', 'b'],
          category: 'music',
          visibility: 'public',
        },
        { videoId: VIDEO_IDS.b, title: 'Second', tags: [], category: null, visibility: 'public' },
      ]);
      expect(read[0]).toMatchObject({ createdAt: new Date(BASE).toISOString(), views: 0 });
    });

    it('narrows the videos to those made on the days of the range', async () => {
      const read = await walk(rows.videos.bind(rows), { ...scope, range: { from: '2026-03-02' } });

      expect(read).toEqual([]);
    });

    describeExportPostRowsContract(makeSubject);
  });
}
