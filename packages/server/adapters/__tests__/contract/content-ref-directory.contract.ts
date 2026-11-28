import { expectOk } from '@kit/testing/result';
import { type ContentRef, contentRefKey } from '@vp/domain';
import { OWNER_CHANNEL_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const { a, b } = VIDEO_IDS;
const CLIP_ID = '00000000-0000-7000-8000-00000000c901';
const PLAYLIST_ID = '00000000-0000-7000-8000-00000000a901';
const GONE_ID = '00000000-0000-7000-8000-0000000000ff';

export function describeContentRefDirectoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ContentRefDirectory contract', () => {
    let subject: RepositoriesSubject;

    const resolve = async (refs: ContentRef[]) =>
      expectOk(await subject.repositories.contentRefs.resolve(refs));

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
      await repositories.videos.create(publicVideo({ id: a, title: 'Open', durationMs: 90_000 }));
      await repositories.videos.create(
        publicVideo({ id: b, title: 'Closed', visibility: 'private' })
      );
      expectOk(
        await repositories.clips.create({
          id: CLIP_ID,
          videoId: a,
          userId: OWNER_ID,
          startMs: 10_000,
          endMs: 25_000,
          title: 'A clip',
          createdAt: new Date('2026-11-01T10:00:00Z'),
        })
      );
      expectOk(
        await repositories.playlists.create({
          id: PLAYLIST_ID,
          ownerId: OWNER_ID,
          title: 'A series',
          description: '',
          visibility: 'public',
          kind: 'series',
        })
      );
    });

    it('resolves a public video, a private one and a clip, each with what it is', async () => {
      const found = await resolve([
        { type: 'video', id: a },
        { type: 'video', id: b },
        { type: 'clip', id: CLIP_ID },
      ]);

      expect(found.get(`video:${a}`)).toMatchObject({
        channelId: OWNER_CHANNEL_ID,
        ownerId: OWNER_ID,
        title: 'Open',
        public: true,
        mediaVideoId: a,
        durationMs: 90_000,
      });
      expect(found.get(`video:${b}`)).toMatchObject({ title: 'Closed', public: false });
      expect(found.get(`clip:${CLIP_ID}`)).toMatchObject({
        title: 'A clip',
        ownerId: OWNER_ID,
        public: false,
        mediaVideoId: a,
        durationMs: 15_000,
      });
    });

    it('resolves a playlist and an episode of it, and leaves out what is gone', async () => {
      const episode: ContentRef = { type: 'episode', playlistId: PLAYLIST_ID, videoId: a };
      const found = await resolve([
        { type: 'playlist', id: PLAYLIST_ID },
        episode,
        { type: 'video', id: GONE_ID },
        { type: 'episode', playlistId: GONE_ID, videoId: a },
      ]);

      expect([...found.keys()].sort()).toEqual(
        [`playlist:${PLAYLIST_ID}`, contentRefKey(episode)].sort()
      );
      expect(found.get(`playlist:${PLAYLIST_ID}`)).toMatchObject({
        title: 'A series',
        public: true,
        channelId: OWNER_CHANNEL_ID,
      });
      expect(found.get(contentRefKey(episode))).toMatchObject({ title: 'Open', public: true });
    });

    it('resolves nothing for no refs', async () => {
      expect((await resolve([])).size).toBe(0);
    });
  });
}
