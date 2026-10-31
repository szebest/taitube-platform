import type { ChannelFeaturedRepositoryPort } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const { a, b, c, d, e, f } = VIDEO_IDS;
const GONE = '00000000-0000-7000-8000-0000000000ff';

export function describeChannelFeaturedRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('ChannelFeaturedRepository contract', () => {
    let subject: RepositoriesSubject;
    let featured: ChannelFeaturedRepositoryPort;
    let channelId: string;
    let otherChannelId: string;

    const list = async (id = channelId) => expectOk(await featured.listForChannel(id));
    const replace = async (ids: string[], id = channelId) =>
      expectOk(await featured.replace(id, ids));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      for (const id of Object.values(VIDEO_IDS)) {
        await subject.repositories.videos.create(publicVideo({ id }));
      }
      const { channels } = subject.repositories;
      channelId = expectOk(
        await channels.create({ userId: OWNER_ID, handle: 'owner', displayName: 'Owner' })
      ).id;
      otherChannelId = expectOk(
        await channels.create({ userId: OTHER_OWNER_ID, handle: 'other', displayName: 'Other' })
      ).id;
      featured = subject.repositories.channelFeatured;
    });

    it('lists nothing for a channel that pinned nothing', async () => {
      expect(await list()).toEqual([]);
    });

    it('keeps the order the videos were saved in', async () => {
      await replace([c, a, b]);

      expect(await list()).toEqual([c, a, b]);
    });

    it('holds six pins', async () => {
      await replace([a, b, c, d, e, f]);

      expect(await list()).toEqual([a, b, c, d, e, f]);
    });

    it.each([
      { scenario: 'shrinks the set', next: [b], expected: [b] },
      { scenario: 'reorders the set', next: [b, a], expected: [b, a] },
      { scenario: 'swaps in new videos', next: [c, a], expected: [c, a] },
      { scenario: 'clears it with an empty list', next: [], expected: [] },
    ])('replaces the whole set when it $scenario', async ({ next, expected }) => {
      await replace([a, b]);

      await replace(next);

      expect(await list()).toEqual(expected);
    });

    it('keeps each channel to its own pins', async () => {
      await replace([a, b]);
      await replace([b], otherChannelId);

      await replace([], otherChannelId);

      expect(await list()).toEqual([a, b]);
      expect(await list(otherChannelId)).toEqual([]);
    });

    it('fails the whole write when a video is gone, leaving the previous set', async () => {
      await replace([a, b]);

      const failure = expectErr(await featured.replace(channelId, [c, GONE]));

      expect(failure.code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
      expect(await list()).toEqual([a, b]);
    });
  });
}
