import type { ChannelPageRepositoryPort } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const { a, b, c } = VIDEO_IDS;
const GONE = '00000000-0000-7000-8000-0000000000ff';

export function describeChannelPageRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelPageRepository contract', () => {
    let subject: RepositoriesSubject;
    let pages: ChannelPageRepositoryPort;
    let channelId: string;
    let otherChannelId: string;

    const settings = async (id = channelId) => expectOk(await pages.getSettings(id));
    const localizations = async (id = channelId) => expectOk(await pages.listLocalizations(id));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      for (const id of [a, b, c]) {
        await subject.repositories.videos.create(publicVideo({ id }));
      }
      const { channels } = subject.repositories;
      channelId = expectOk(
        await channels.create({ userId: OWNER_ID, handle: 'owner', displayName: 'Owner' })
      ).id;
      otherChannelId = expectOk(
        await channels.create({ userId: OTHER_OWNER_ID, handle: 'other', displayName: 'Other' })
      ).id;
      pages = subject.repositories.channelPages;
    });

    it('reads both slots empty and no localizations for a channel that saved nothing', async () => {
      expect(await settings()).toEqual({ trailerVideoId: null, returningVideoId: null });
      expect(await localizations()).toEqual([]);
    });

    it('keeps what was saved, localizations ordered by locale', async () => {
      const pl = { locale: 'pl', description: 'Opis', trailerVideoId: b };
      const en = { locale: 'en', description: null, trailerVideoId: null };

      expectOk(
        await pages.replace(channelId, { trailerVideoId: a, returningVideoId: c }, [pl, en])
      );

      expect(await settings()).toEqual({ trailerVideoId: a, returningVideoId: c });
      expect(await localizations()).toEqual([en, pl]);
    });

    it('replaces the whole set, so what the next save leaves out is gone', async () => {
      expectOk(
        await pages.replace(channelId, { trailerVideoId: a, returningVideoId: b }, [
          { locale: 'pl', description: 'Opis', trailerVideoId: null },
        ])
      );

      expectOk(await pages.replace(channelId, { trailerVideoId: null, returningVideoId: b }, []));

      expect(await settings()).toEqual({ trailerVideoId: null, returningVideoId: b });
      expect(await localizations()).toEqual([]);
    });

    it('keeps each channel to its own page', async () => {
      expectOk(await pages.replace(channelId, { trailerVideoId: a, returningVideoId: null }, []));
      expectOk(
        await pages.replace(otherChannelId, { trailerVideoId: b, returningVideoId: null }, [])
      );

      expect((await settings()).trailerVideoId).toBe(a);
      expect((await settings(otherChannelId)).trailerVideoId).toBe(b);
    });

    it.each([
      { slot: 'the trailer', settings: { trailerVideoId: GONE, returningVideoId: null }, rows: [] },
      {
        slot: 'the returning video',
        settings: { trailerVideoId: null, returningVideoId: GONE },
        rows: [],
      },
      {
        slot: 'a localized trailer',
        settings: { trailerVideoId: null, returningVideoId: null },
        rows: [{ locale: 'pl', description: null, trailerVideoId: GONE }],
      },
    ])(
      'fails the whole write when $slot is a video that is gone, leaving what was saved',
      async ({ settings: next, rows }) => {
        expectOk(await pages.replace(channelId, { trailerVideoId: a, returningVideoId: null }, []));

        expect(expectErr(await pages.replace(channelId, next, rows)).code).toBe(
          ErrorCodes.DATABASE_UNAVAILABLE
        );
        expect((await settings()).trailerVideoId).toBe(a);
        expect(await localizations()).toEqual([]);
      }
    );
  });
}
