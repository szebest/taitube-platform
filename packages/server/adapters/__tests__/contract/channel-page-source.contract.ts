import { expectOk } from '@kit/testing/result';
import type { PoolRequest } from '@vp/core/repositories';
import { POST_IDS, postAudit, postInput } from './channel-post-contract-context';
import {
  HOUR_MS,
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
  publicVideo,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const PLAYLIST_ID = '00000000-0000-7000-8000-0000000001b1';
const PRIVATE_PLAYLIST_ID = '00000000-0000-7000-8000-0000000001b2';
const NOW = new Date('2026-12-01T12:00:00.000Z');
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR_MS);

const request = (key: string, overrides: Partial<PoolRequest> = {}): PoolRequest => ({
  key,
  sort: 'newest',
  limit: 10,
  tags: [],
  since: null,
  until: null,
  minDurationSec: null,
  maxDurationSec: null,
  ...overrides,
});

export function describeChannelPageSourceContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelPageSourceRepository contract', () => {
    let subject: RepositoriesSubject;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      const { a, b, c, d, e } = VIDEO_IDS;
      await subject.seedVideo(publicVideo({ id: a, tags: ['gear'], durationMs: 60_000 }), ago(5));
      await subject.seedVideo(publicVideo({ id: b, viewsCount: 90, durationMs: 600_000 }), ago(3));
      await subject.seedVideo(publicVideo({ id: c, format: 'short', durationMs: 20_000 }), ago(2));
      await subject.seedVideo(publicVideo({ id: d, visibility: 'private' }), ago(1));
      await subject.seedVideo(
        publicVideo({ id: e, ownerId: OTHER_OWNER_ID, viewsCount: 500 }),
        ago(1)
      );
      await subject.repositories.channelPosts.publish(
        postInput(POST_IDS.a),
        postAudit('post.published', POST_IDS.a)
      );
      const { playlists } = subject.repositories;
      for (const [id, visibility] of [
        [PLAYLIST_ID, 'public'],
        [PRIVATE_PLAYLIST_ID, 'private'],
      ] as const) {
        await playlists.create({
          id,
          ownerId: OWNER_ID,
          title: 'Series',
          description: '',
          visibility,
        });
      }
      for (const [index, videoId] of [b, a, d].entries()) {
        await playlists.addItem(
          PLAYLIST_ID,
          { id: `00000000-0000-7000-8000-0000000003${index}0`, videoId, addedBy: OWNER_ID },
          OWNER_ID
        );
      }
    });

    const pool = async (
      type: 'videos' | 'shorts' | 'posts' | 'playlists',
      ...requests: PoolRequest[]
    ) =>
      expectOk(
        await subject.repositories.channelPageSources.pool(
          OWNER_CHANNEL_ID,
          OWNER_ID,
          type,
          requests
        )
      );

    it('answers every section of a type in one call, each in its own order and limit', async () => {
      const found = await pool(
        'videos',
        request('newest', { limit: 1 }),
        request('oldest', { sort: 'oldest' }),
        request('popular', { sort: 'popular' }),
        request('tagged', { tags: ['gear'] }),
        request('long', { minDurationSec: 120 }),
        request('window', { since: ago(4), until: ago(2.5) })
      );

      const ids = (key: string) => found[key]?.map(({ id }) => id);
      expect(ids('newest')).toEqual([VIDEO_IDS.b]);
      expect(ids('oldest')).toEqual([VIDEO_IDS.a, VIDEO_IDS.b]);
      expect(ids('popular')).toEqual([VIDEO_IDS.b, VIDEO_IDS.a]);
      expect(ids('tagged')).toEqual([VIDEO_IDS.a]);
      expect(ids('long')).toEqual([VIDEO_IDS.b]);
      expect(ids('window')).toEqual([VIDEO_IDS.b]);
    });

    it('keeps Shorts, posts and playlists to their own type, the channel and what is public', async () => {
      expect((await pool('shorts', request('s')))['s']?.map(({ id }) => id)).toEqual([VIDEO_IDS.c]);
      expect((await pool('posts', request('p')))['p']).toEqual([{ kind: 'post', id: POST_IDS.a }]);
      expect((await pool('playlists', request('l')))['l']).toEqual([
        { kind: 'playlist', id: PLAYLIST_ID },
      ]);
    });

    it('answers the public videos of the named playlists in position order, none for a private one', async () => {
      const found = expectOk(
        await subject.repositories.channelPageSources.playlistItems([
          { key: 'series', playlistId: PLAYLIST_ID, limit: 10 },
          { key: 'hidden', playlistId: PRIVATE_PLAYLIST_ID, limit: 10 },
        ])
      );

      expect(found['series']?.map(({ id }) => id)).toEqual([VIDEO_IDS.b, VIDEO_IDS.a]);
      expect(found['hidden']).toEqual([]);
    });

    it('evaluates smart rules over the channel own public videos only', async () => {
      const found = expectOk(
        await subject.repositories.channelPageSources.smart(
          OWNER_CHANNEL_ID,
          [
            {
              key: 'popular',
              rules: { match: 'all', conditions: [], sort: 'popular', limit: 50 },
              limit: 10,
            },
          ],
          NOW
        )
      );

      expect(found['popular']?.map(({ id }) => id)).toEqual([
        VIDEO_IDS.b,
        VIDEO_IDS.c,
        VIDEO_IDS.a,
      ]);
    });

    it('answers the pins that qualify, else the most viewed uploads', async () => {
      const { channelPageSources, channelFeatured } = subject.repositories;
      const startHere = async () =>
        expectOk(await channelPageSources.startHere(OWNER_CHANNEL_ID, 5)).map(({ id }) => id);

      expect(await startHere()).toEqual([VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.a]);

      expectOk(await channelFeatured.replace(OWNER_CHANNEL_ID, [VIDEO_IDS.c, VIDEO_IDS.a]));
      expect(await startHere()).toEqual([VIDEO_IDS.c, VIDEO_IDS.a]);
    });

    it('hydrates what is public and leaves out what is private, gone or of another kind', async () => {
      const rows = expectOk(
        await subject.repositories.channelPageSources.hydrate([
          { kind: 'video', id: VIDEO_IDS.b },
          { kind: 'video', id: VIDEO_IDS.d },
          { kind: 'post', id: POST_IDS.a },
          { kind: 'playlist', id: PLAYLIST_ID },
          { kind: 'playlist', id: PRIVATE_PLAYLIST_ID },
          { kind: 'channel', id: OTHER_OWNER_CHANNEL_ID },
          { kind: 'post', id: POST_IDS.missing },
        ])
      );

      expect(rows.map(({ kind, id }) => `${kind}:${id}`).sort()).toEqual(
        [
          `video:${VIDEO_IDS.b}`,
          `post:${POST_IDS.a}`,
          `playlist:${PLAYLIST_ID}`,
          `channel:${OTHER_OWNER_CHANNEL_ID}`,
        ].sort()
      );
      expect(rows.find(({ kind }) => kind === 'video')).toMatchObject({
        title: 'Video b',
        viewsCount: 90,
        channelId: OWNER_CHANNEL_ID,
      });
      expect(rows.find(({ kind }) => kind === 'post')).toMatchObject({ title: 'Post 1' });
      expect(rows.find(({ kind }) => kind === 'playlist')).toMatchObject({
        itemCount: 3,
        ownerUserId: OWNER_ID,
      });
    });
  });
}
