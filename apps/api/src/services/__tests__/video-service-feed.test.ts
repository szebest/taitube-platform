import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { expectOk } from '@vp/testing/result';
import { VideoService } from '../video-service';
import { videoServiceDeps } from './service-deps';

const HOUR_MS = 3_600_000;

describe('VideoService.listPublic', () => {
  const repositories = new InMemoryRepositories();
  const videoService = new VideoService(videoServiceDeps(repositories.videos));

  const OWNER_1 = '00000000-0000-7000-8000-000000000001';
  const OWNER_2 = '00000000-0000-7000-8000-000000000002';
  const CAT_A = '11111111-1111-7111-8111-111111111111';
  const CAT_B = '22222222-2222-7222-8222-222222222222';

  it('filters only public AND READY videos, across all owners, ignoring private/unlisted or non-READY', async () => {
    repositories.clear();

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000001',
      ownerId: OWNER_1,
      title: 'Public Ready 1',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/1.mp4',
    });

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000002',
      ownerId: OWNER_2,
      title: 'Public Ready 2',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/2.mp4',
    });

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000003',
      ownerId: OWNER_1,
      title: 'Private Ready',
      visibility: 'private',
      status: 'READY',
      sourceKey: 'raw/3.mp4',
    });

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000004',
      ownerId: OWNER_1,
      title: 'Unlisted Ready',
      visibility: 'unlisted',
      status: 'READY',
      sourceKey: 'raw/4.mp4',
    });

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000005',
      ownerId: OWNER_2,
      title: 'Public Processing',
      visibility: 'public',
      status: 'PROCESSING',
      sourceKey: 'raw/5.mp4',
    });

    const feed = expectOk(await videoService.listPublic({}));
    expect(feed.total).toBe(2);
    expect(feed.items).toHaveLength(2);
    const titles = feed.items.map((i) => i.title);
    expect(titles).toContain('Public Ready 1');
    expect(titles).toContain('Public Ready 2');
    expect(titles).not.toContain('Private Ready');
    expect(titles).not.toContain('Unlisted Ready');
    expect(titles).not.toContain('Public Processing');
  });

  it('supports categoryId UUID filter', async () => {
    repositories.clear();

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000010',
      ownerId: OWNER_1,
      title: 'Category A Video',
      visibility: 'public',
      status: 'READY',
      categoryId: CAT_A,
      sourceKey: 'raw/10.mp4',
    });

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000011',
      ownerId: OWNER_2,
      title: 'Category B Video',
      visibility: 'public',
      status: 'READY',
      categoryId: CAT_B,
      sourceKey: 'raw/11.mp4',
    });

    const feedA = expectOk(await videoService.listPublic({ categoryId: CAT_A }));
    expect(feedA.total).toBe(1);
    expect(feedA.items).toHaveLength(1);
    expect(feedA.items[0]?.title).toBe('Category A Video');

    const feedB = expectOk(await videoService.listPublic({ categoryId: CAT_B }));
    expect(feedB.total).toBe(1);
    expect(feedB.items).toHaveLength(1);
    expect(feedB.items[0]?.title).toBe('Category B Video');
  });

  it('supports sort=popular by viewsCount descending', async () => {
    repositories.clear();

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000021',
      ownerId: OWNER_1,
      title: 'Low views',
      visibility: 'public',
      status: 'READY',
      viewsCount: 10,
      sourceKey: 'raw/21.mp4',
    });

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000022',
      ownerId: OWNER_1,
      title: 'High views',
      visibility: 'public',
      status: 'READY',
      viewsCount: 1000,
      sourceKey: 'raw/22.mp4',
    });

    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000023',
      ownerId: OWNER_2,
      title: 'Medium views',
      visibility: 'public',
      status: 'READY',
      viewsCount: 250,
      sourceKey: 'raw/23.mp4',
    });

    const feed = expectOk(await videoService.listPublic({ sort: 'popular' }));
    expect(feed.items).toHaveLength(3);
    expect(feed.items[0]?.title).toBe('High views');
    expect(feed.items[1]?.title).toBe('Medium views');
    expect(feed.items[2]?.title).toBe('Low views');
  });

  it('supports sort=trending gravity score with time-decay', async () => {
    repositories.clear();

    const now = Date.now();

    const fresh = expectOk(
      await repositories.videos.create({
        id: '018f0000-0000-7000-8000-000000000031',
        ownerId: OWNER_1,
        title: 'Fresh Video',
        visibility: 'public',
        status: 'READY',
        viewsCount: 100,
        sourceKey: 'raw/31.mp4',
      })
    );
    fresh.createdAt = new Date(now - HOUR_MS);

    const old = expectOk(
      await repositories.videos.create({
        id: '018f0000-0000-7000-8000-000000000032',
        ownerId: OWNER_1,
        title: 'Old Video',
        visibility: 'public',
        status: 'READY',
        viewsCount: 150,
        sourceKey: 'raw/32.mp4',
      })
    );
    old.createdAt = new Date(now - 100 * HOUR_MS);

    const feed = expectOk(await videoService.listPublic({ sort: 'trending' }));
    expect(feed.items[0]?.title).toBe('Fresh Video');
    expect(feed.items[1]?.title).toBe('Old Video');
  });

  it('keyset pagination with limit and nextCursor across sort modes', async () => {
    repositories.clear();

    for (let i = 1; i <= 5; i++) {
      await repositories.videos.create({
        id: `018f0000-0000-7000-8000-0000000000${i}0`,
        ownerId: OWNER_1,
        title: `Video ${i}`,
        visibility: 'public',
        status: 'READY',
        viewsCount: i * 100,
        sourceKey: `raw/${i}.mp4`,
      });
    }

    const page1 = expectOk(await videoService.listPublic({ sort: 'popular', limit: 2 }));
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0]?.title).toBe('Video 5');
    expect(page1.items[1]?.title).toBe('Video 4');
    expect(page1.nextCursor).not.toBeNull();
    expect(page1.total).toBe(5);

    const cursor1 = page1.nextCursor ?? undefined;
    const page2 = expectOk(
      await videoService.listPublic({
        sort: 'popular',
        limit: 2,
        cursor: cursor1,
      })
    );
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0]?.title).toBe('Video 3');
    expect(page2.items[1]?.title).toBe('Video 2');
    expect(page2.nextCursor).not.toBeNull();

    const cursor2 = page2.nextCursor ?? undefined;
    const page3 = expectOk(
      await videoService.listPublic({
        sort: 'popular',
        limit: 2,
        cursor: cursor2,
      })
    );
    expect(page3.items).toHaveLength(1);
    expect(page3.items[0]?.title).toBe('Video 1');
    expect(page3.nextCursor).toBeNull();
  });
});
