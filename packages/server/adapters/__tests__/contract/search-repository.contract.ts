import type { SearchHit, SearchQuery, SearchRepositoryPort } from '@vp/core/repositories';
import { searchKinds } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  CATEGORY_MUSIC_ID,
  HOUR_MS,
  OTHER_OWNER_ID,
  OWNER_ID,
  publicVideo,
  seedCategories,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const S = {
  channel: '00000000-0000-7000-8000-0000000047c1',
  otherChannel: '00000000-0000-7000-8000-0000000047c2',
  course: '00000000-0000-7000-8000-0000000047a1',
  tricks: '00000000-0000-7000-8000-0000000047a2',
  secret: '00000000-0000-7000-8000-0000000047a3',
  unlisted: '00000000-0000-7000-8000-0000000047a4',
  encoding: '00000000-0000-7000-8000-0000000047a5',
  deleted: '00000000-0000-7000-8000-0000000047a6',
  aside: '00000000-0000-7000-8000-0000000047a7',
  takenDown: '00000000-0000-7000-8000-0000000047a8',
  essentials: '00000000-0000-7000-8000-0000000047b1',
  hidden: '00000000-0000-7000-8000-0000000047b2',
} as const;

const NOW = Date.now();

function query(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return {
    text: 'javascript',
    kinds: searchKinds('all'),
    sort: 'relevance',
    mode: 'lexical',
    instant: NOW,
    categoryId: null,
    cursor: null,
    limit: 20,
    ...overrides,
  };
}

function positions(hits: readonly SearchHit[]): string[] {
  return hits.map((hit) => `${hit.kind}:${hit.id}`);
}

export function describeSearchRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('SearchRepository contract', () => {
    let subject: RepositoriesSubject;
    let search: SearchRepositoryPort;

    const run = async (overrides: Partial<SearchQuery> = {}) =>
      expectOk(await search.search(query(overrides)));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      const { repositories } = subject;
      search = repositories.search;
      await seedOwners(repositories);
      await seedCategories(repositories);
      expectOk(
        await repositories.channels.create({
          id: S.channel,
          userId: OWNER_ID,
          handle: 'jsmastery',
          displayName: 'JavaScript Mastery',
          bio: 'Weekly javascript lessons',
          subscriberCount: 5000,
        })
      );
      expectOk(
        await repositories.channels.create({
          id: S.otherChannel,
          userId: OTHER_OWNER_ID,
          handle: 'cooking',
          displayName: 'Slow Cooking',
        })
      );
      const hourAgo = new Date(NOW - HOUR_MS);
      await subject.seedVideo(
        publicVideo({
          id: S.course,
          title: 'Learn JavaScript in one hour',
          tags: ['frontend'],
          viewsCount: 900,
          categoryId: CATEGORY_MUSIC_ID,
          posterKey: 'videos/course/poster.jpg',
        }),
        hourAgo
      );
      await subject.seedVideo(
        publicVideo({ id: S.tricks, title: 'Array tricks', tags: ['javascript'], viewsCount: 900 }),
        hourAgo
      );
      await subject.seedVideo(
        publicVideo({ id: S.aside, title: 'Weekend vlog', description: 'some javascript' }),
        hourAgo
      );
      await subject.seedVideo(
        publicVideo({ id: S.secret, title: 'Private javascript', visibility: 'private' })
      );
      await subject.seedVideo(
        publicVideo({ id: S.unlisted, title: 'Unlisted javascript', visibility: 'unlisted' })
      );
      await subject.seedVideo(
        publicVideo({ id: S.encoding, title: 'Encoding javascript', status: 'PROCESSING' })
      );
      await subject.seedVideo(
        publicVideo({ id: S.takenDown, title: 'Taken down javascript', status: 'REJECTED' })
      );
      await subject.seedVideo(
        publicVideo({ id: S.deleted, title: 'Deleted javascript', deletedAt: new Date(NOW) })
      );
      const { playlists } = repositories;
      expectOk(
        await playlists.create({
          id: S.essentials,
          ownerId: OWNER_ID,
          title: 'JavaScript essentials',
          description: 'the basics',
          visibility: 'public',
        })
      );
      expectOk(
        await playlists.create({
          id: S.hidden,
          ownerId: OWNER_ID,
          title: 'JavaScript drafts',
          description: '',
          visibility: 'private',
        })
      );
      for (const [n, videoId] of [
        S.secret,
        S.takenDown,
        S.unlisted,
        S.course,
        S.tricks,
      ].entries()) {
        const id = `00000000-0000-7000-8000-0000000047d${n}`;
        expectOk(await playlists.addItem(S.essentials, { id, videoId }));
      }
    });

    it('mixes every public kind and leaves out what a stranger may not see, counts included', async () => {
      const page = await run();

      expect(positions(page.hits).sort()).toEqual(
        [
          `channel:${S.channel}`,
          `video:${S.course}`,
          `video:${S.tricks}`,
          `video:${S.aside}`,
          `playlist:${S.essentials}`,
        ].sort()
      );
      expect(page.total).toBe(5);
    });

    it('ranks a title over a tag over a description at equal popularity and age', async () => {
      const videos = (await run({ kinds: ['video'] })).hits;

      expect(positions(videos)).toEqual([
        `video:${S.course}`,
        `video:${S.tricks}`,
        `video:${S.aside}`,
      ]);
    });

    it.each(['jsmastery', '@jsmastery', 'javascript mastery'])(
      'pins the channel named exactly %j above everything else',
      async (text) => {
        const [first] = (await run({ text })).hits;

        expect(first && `${first.kind}:${first.id}`).toBe(`channel:${S.channel}`);
      }
    );

    it.each([
      { kinds: ['playlist'] as const, only: 'playlist' },
      { kinds: ['channel'] as const, only: 'channel' },
      { kinds: ['video'] as const, only: 'video' },
    ])('returns only $only hits when asked for $kinds', async ({ kinds, only }) => {
      const page = await run({ kinds });

      expect(page.hits.length).toBeGreaterThan(0);
      expect(new Set(page.hits.map((hit) => hit.kind))).toEqual(new Set([only]));
    });

    it('describes a playlist by its public ready videos, not private, unlisted or taken-down ones', async () => {
      const [hit] = (await run({ kinds: ['playlist'] })).hits;

      expect(hit?.kind === 'playlist' && hit.card).toMatchObject({
        playlist: { id: S.essentials, title: 'JavaScript essentials' },
        owner: { id: S.channel, handle: 'jsmastery' },
        videoCount: 2,
        coverKey: 'videos/course/poster.jpg',
      });
    });

    it('narrows videos by category and leaves the other kinds alone', async () => {
      const page = await run({ categoryId: CATEGORY_MUSIC_ID });

      expect(page.hits.filter((hit) => hit.kind === 'video').map((hit) => hit.id)).toEqual([
        S.course,
      ]);
      expect(page.hits.some((hit) => hit.kind === 'channel')).toBe(true);
    });

    it('finds nothing lexically for a typo and recovers it through trigrams', async () => {
      expect((await run({ text: 'javascrip' })).total).toBe(0);

      const fuzzy = await run({ text: 'javascrip', mode: 'fuzzy' });

      expect(positions(fuzzy.hits).sort()).toEqual(
        [`channel:${S.channel}`, `video:${S.course}`, `playlist:${S.essentials}`].sort()
      );
      expect(fuzzy.total).toBe(3);
    });

    it('recovers a misspelled handle through trigrams', async () => {
      const page = await run({ text: 'jsmastry', mode: 'fuzzy', kinds: ['channel'] });

      expect(page.hits.map((hit) => hit.id)).toEqual([S.channel]);
    });

    it.each(['relevance', 'date', 'views'] as const)(
      'walks every %s page once, in the order of one big page',
      async (sort) => {
        const whole = positions((await run({ sort })).hits);
        const walked: string[] = [];
        let cursor: SearchQuery['cursor'] = null;
        for (let page = 0; page < whole.length + 1; page += 1) {
          const { hits } = await run({ sort, cursor, limit: 2 });
          walked.push(...positions(hits.slice(0, 2)));
          const last = hits[1];
          if (hits.length <= 2 || !last) break;
          cursor = { key: last.key, kind: last.kind, id: last.id };
        }

        expect(walked).toEqual(whole);
      }
    );

    it('orders by date newest first and by audience largest first', async () => {
      const byDate = (await run({ sort: 'date', kinds: ['video'] })).hits;
      const byViews = (await run({ sort: 'views', kinds: ['video', 'channel'] })).hits;

      expect(byDate.map((hit) => hit.key)).toEqual(
        [...byDate.map((hit) => hit.key)].sort((a, b) => b - a)
      );
      expect(positions(byViews)[0]).toBe(`channel:${S.channel}`);
    });

    it.each(['javascript', 'javascript -fast', '"learn javascript"'])(
      'reads %j as a query that narrows the search',
      async (text) => {
        expect(expectOk(await search.restricts(text))).toBe(true);
      }
    );

    it('suggests channels by handle or name prefix, most subscribed first', async () => {
      expect(expectOk(await search.suggestChannels('jsm', 3)).map((c) => c.id)).toEqual([
        S.channel,
      ]);
      expect(expectOk(await search.suggestChannels('slow', 3)).map((c) => c.id)).toEqual([
        S.otherChannel,
      ]);
      expect(expectOk(await search.suggestChannels('%', 3))).toEqual([]);
    });
  });
}
