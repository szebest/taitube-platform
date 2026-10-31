import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { FEATURED_VIDEOS_MAX } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { ChannelFeaturedService } from '../channel-featured-service';
import { VideoService } from '../video-service';
import { videoServiceDeps } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000f001', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000f002', role: 'USER' };
const CHANNEL = '00000000-0000-7000-8000-00000000f0c1';
const video = (n: number) => `00000000-0000-7000-8000-00000000f0b${n}`;
const ABSENT = '00000000-0000-7000-8000-00000000f0ff';

describe('apps/server/api/services: ChannelFeaturedService', () => {
  let repositories: InMemoryRepositories;
  let service: ChannelFeaturedService;

  const itemIds = (view: { items: { id: string }[] }) => view.items.map((item) => item.id);
  const pin = async (ids: string[], caller = OWNER) => service.replace(caller, ids);
  const read = async () => expectOk(await service.get('@owner'));

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new ChannelFeaturedService({
      channels: repositories.channels,
      featured: repositories.channelFeatured,
      videos: repositories.videos,
      videoService: new VideoService(
        videoServiceDeps(repositories.videos, { channels: repositories.channels })
      ),
    });
    await repositories.channels.create({
      id: CHANNEL,
      userId: OWNER.id,
      handle: 'owner',
      displayName: 'Owner',
    });
    await repositories.channels.create({
      userId: STRANGER.id,
      handle: 'stranger',
      displayName: 'Stranger',
    });
    for (let n = 1; n <= 8; n++) {
      await seedVideo(repositories, { id: video(n), ownerId: OWNER.id, viewsCount: n * 10 });
    }
  });

  describe('replace', () => {
    it('pins the videos in the order given and answers the shelf a visitor now reads', async () => {
      const view = expectOk(await pin([video(3), video(1), video(2)]));

      expect(view.source).toBe('pinned');
      expect(itemIds(view)).toEqual([video(3), video(1), video(2)]);
      expect(view.items[0]?.channel).toMatchObject({ handle: 'owner' });
      expect(itemIds(await read())).toEqual([video(3), video(1), video(2)]);
    });

    it('replaces the previous pins', async () => {
      await pin([video(1), video(2)]);

      await pin([video(2), video(4)]);

      expect(itemIds(await read())).toEqual([video(2), video(4)]);
    });

    it('clears the shelf with an empty list, back to the most viewed', async () => {
      await pin([video(1)]);

      const view = expectOk(await pin([]));

      expect(view.source).toBe('popular');
    });

    it('holds six pins', async () => {
      const ids = [1, 2, 3, 4, 5, 6].map(video);

      expect(itemIds(expectOk(await pin(ids)))).toEqual(ids);
    });

    it.each([
      {
        scenario: 'a seventh video',
        ids: [1, 2, 3, 4, 5, 6, 7].map(video),
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a video twice',
        ids: [video(1), video(1)],
        code: ErrorCodes.VALIDATION_FAILED,
      },
      { scenario: 'a video that does not exist', ids: [ABSENT], code: ErrorCodes.VIDEO_NOT_FOUND },
    ])('refuses $scenario with $code', async ({ ids, code }) => {
      await pin([video(8)]);

      expect(expectErr(await pin(ids)).code).toBe(code);
      expect(itemIds(await read())).toEqual([video(8)]);
    });

    it.each([
      {
        scenario: 'a private video',
        extra: { visibility: 'private' as const },
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a video still processing',
        extra: { status: 'PROCESSING' as const },
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $scenario of the owner with $code', async ({ extra, code }) => {
      await seedVideo(repositories, { id: ABSENT, ownerId: OWNER.id, ...extra });

      expect(expectErr(await pin([ABSENT])).code).toBe(code);
    });

    it("refuses another creator's video as forbidden, and nothing is saved", async () => {
      const failure = expectErr(await pin([video(1)], STRANGER));

      expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
      expect(expectOk(await repositories.channelFeatured.listForChannel(CHANNEL))).toEqual([]);
    });

    it('answers CHANNEL_NOT_FOUND for a caller without a channel', async () => {
      const nobody: UserContext = { id: '00000000-0000-7000-8000-00000000f0ee', role: 'USER' };

      expect(expectErr(await pin([], nobody)).code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });

  describe('get', () => {
    it('shows the six most-viewed public uploads when nothing is pinned', async () => {
      const view = await read();

      expect(view.source).toBe('popular');
      expect(itemIds(view)).toEqual([8, 7, 6, 5, 4, 3].map(video));
      expect(view.items).toHaveLength(FEATURED_VIDEOS_MAX);
    });

    it('leaves out what the channel has not made public', async () => {
      await seedVideo(repositories, {
        id: ABSENT,
        ownerId: OWNER.id,
        viewsCount: 9_999,
        visibility: 'private',
      });

      expect(itemIds(await read())).not.toContain(ABSENT);
    });

    it('shows a short list of videos for a channel with fewer than six', async () => {
      await repositories.channels.create({
        userId: '00000000-0000-7000-8000-00000000f0dd',
        handle: 'newcomer',
        displayName: 'Newcomer',
      });

      const view = expectOk(await service.get('newcomer'));

      expect(view).toEqual({ source: 'popular', items: [] });
    });

    it('drops a pinned video that turned private, with no save in between', async () => {
      await pin([video(1), video(2), video(3)]);
      const stored = expectOk(await repositories.videos.findById(video(2)));
      if (stored) stored.visibility = 'private';

      expect(itemIds(await read())).toEqual([video(1), video(3)]);
    });

    it('drops a pinned video that was deleted', async () => {
      await pin([video(1), video(2)]);
      const stored = expectOk(await repositories.videos.findById(video(1)));
      if (stored) stored.status = 'DELETED';

      expect(itemIds(await read())).toEqual([video(2)]);
    });

    it('falls back to the most viewed once no pin qualifies', async () => {
      await pin([video(1)]);
      const stored = expectOk(await repositories.videos.findById(video(1)));
      if (stored) stored.visibility = 'unlisted';

      const view = await read();

      expect(view.source).toBe('popular');
      expect(itemIds(view)).not.toContain(video(1));
    });

    it('finds the channel by id as well as by handle', async () => {
      expect(expectOk(await service.get(CHANNEL)).source).toBe('popular');
    });

    it('answers CHANNEL_NOT_FOUND for an unknown channel', async () => {
      expect(expectErr(await service.get('@nobody')).code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });
});
