import { expectOk } from '@kit/testing/result';
import type { ContentRef } from '@vp/domain';
import {
  CHANNEL_A,
  CHANNEL_B,
  CREATOR_A,
  CREATOR_B,
  linkHarness,
  VIEWER,
  video,
} from './content-link-harness';

const source = video('a', 1);
const full = video('a', 2);

describe('apps/server/api/services: ContentLinkReads', () => {
  describe.each(['on', 'off'] as const)('with the cache %s', (cache) => {
    let h: Awaited<ReturnType<typeof linkHarness>>;

    const read = async (ref: ContentRef = full, viewer = VIEWER) =>
      expectOk(await h.reads.forItems([ref], viewer))[0];

    beforeEach(async () => {
      h = await linkHarness({ cache });
      await h.seed(source, CREATOR_A, CHANNEL_A, { format: 'short', title: 'The Short' });
      await h.seed(full, CREATOR_A, CHANNEL_A, { title: 'The full video' });
      expectOk(
        await h.service.create(CREATOR_A, {
          source,
          target: full,
          params: { relation: 'full_video' },
        })
      );
    });

    it('lists "Cut into 1 Short" on the full video and the full video on the Short', async () => {
      expect((await read())?.incoming).toMatchObject([
        { relation: 'full_video', count: 1, samples: [{ item: { title: 'The Short' } }] },
      ]);
      expect((await read(source))?.outgoing).toMatchObject([
        { relation: 'full_video', links: [{ item: { title: 'The full video' } }] },
      ]);
    });

    it.each([
      { scenario: 'a private Short', patch: { visibility: 'private' as const } },
      { scenario: 'an unlisted Short', patch: { visibility: 'unlisted' as const } },
    ])('never lists, counts or names $scenario', async ({ patch }) => {
      await read();
      const stored = expectOk(await h.repositories.videos.findById(source.id));
      if (stored) stored.visibility = patch.visibility;

      const view = await read();

      expect(JSON.stringify(view)).not.toContain('The Short');
      expect(view?.incoming).toEqual([]);
    });
  });

  describe('the ref asked for', () => {
    it.each([
      { scenario: 'a stranger', viewer: VIEWER, listed: false },
      { scenario: 'the owner', viewer: CREATOR_A, listed: true },
    ])('lists the links of a private Short to $scenario: $listed', async ({ viewer, listed }) => {
      const h = await linkHarness();
      await h.seed(source, CREATOR_A, CHANNEL_A, { visibility: 'private' });
      await h.seed(full, CREATOR_A, CHANNEL_A);
      expectOk(
        await h.service.create(CREATOR_A, {
          source,
          target: full,
          params: { relation: 'full_video' },
        })
      );

      const [view] = expectOk(await h.reads.forItems([source], viewer));

      expect(view?.outgoing.length).toBe(listed ? 1 : 0);
    });
  });

  describe('lifecycle', () => {
    it('breaks inbound links when a target is deleted and answers nothing for it', async () => {
      const h = await linkHarness();
      await h.seed(source, CREATOR_A, CHANNEL_A);
      await h.seed(full, CREATOR_A, CHANNEL_A);
      const created = expectOk(
        await h.service.create(CREATOR_A, {
          source,
          target: full,
          params: { relation: 'full_video' },
        })
      );

      expectOk(await h.service.markTargetGone(full));

      const fixups = expectOk(
        await h.service.list(
          CREATOR_A,
          { channelId: CHANNEL_A, ownerId: CREATOR_A.id, role: 'owner' },
          'fixups'
        )
      );
      expect(fixups.map(({ id, status }) => [id, status])).toEqual([[created.id, 'broken']]);
      expect(expectOk(await h.reads.forItems([source], VIEWER))[0]?.outgoing).toEqual([]);
    });
  });

  describe('batching', () => {
    it('reads the links of many items with one link read and one hydration', async () => {
      const h = await linkHarness();
      const refs: ContentRef[] = [];
      for (let n = 1; n <= 20; n++) {
        refs.push(video('a', n));
        await h.seed(video('a', n), CREATOR_A, CHANNEL_A);
      }
      for (let n = 1; n < 20; n++) {
        expectOk(
          await h.service.create(CREATOR_A, {
            source: video('a', n),
            target: video('a', n + 1),
            params: { relation: 'related' },
          })
        );
      }
      await h.seed(video('b', 1), CREATOR_B, CHANNEL_B);
      const touching = vi.spyOn(h.repositories.contentLinks, 'touching');
      const resolve = vi.spyOn(h.repositories.contentRefs, 'resolve');
      const history = vi.spyOn(h.repositories.watchHistory, 'findMany');
      const clips = vi.spyOn(h.repositories.clips, 'listOwnByVideos');

      const items = expectOk(await h.reads.forItems(refs, VIEWER));

      expect(items).toHaveLength(20);
      expect(touching).toHaveBeenCalledTimes(1);
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(history.mock.calls.length + clips.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });
});
