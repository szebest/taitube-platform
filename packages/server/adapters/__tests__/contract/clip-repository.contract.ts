import type { ClipRepositoryPort } from '@vp/core/repositories';
import type { Clip, ClipEntry } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const BASE = Date.parse('2026-03-01T12:00:00.000Z');
const CREATOR: UserContext = { id: OTHER_OWNER_ID, role: 'USER' };

const clipId = (n: number) => `00000000-0000-7000-8000-00000000c1${String(n).padStart(2, '0')}`;

function clip(n: number, overrides: Partial<Clip> = {}): Clip {
  return {
    id: clipId(n),
    videoId: VIDEO_IDS.a,
    userId: CREATOR.id,
    startMs: 10_000,
    endMs: 30_000,
    title: `Clip ${n}`,
    createdAt: new Date(BASE + n * 60_000),
    ...overrides,
  };
}

const idsOf = (entries: readonly ClipEntry[]) => entries.map((entry) => entry.clip.id);

export function describeClipRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ClipRepository contract', () => {
    let subject: RepositoriesSubject;
    let clips: ClipRepositoryPort;

    const list = async (limit = 10, viewer = CREATOR) =>
      expectOk(await clips.listByCreator(viewer, { cursor: null, limit }));

    const save = async (...rows: Clip[]) => {
      for (const row of rows) expectOk(await clips.create(row));
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));
      await subject.repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'The Owner',
      });
      clips = subject.repositories.clips;
    });

    it('finds a stored clip by id and answers null for an unknown one', async () => {
      await save(clip(1));

      expect(expectOk(await clips.findById(clipId(1)))).toEqual(clip(1));
      expect(expectOk(await clips.findById(clipId(2)))).toBeNull();
    });

    it('removes a clip once and reports whether it was there', async () => {
      await save(clip(1));

      expect(expectOk(await clips.remove(clipId(1)))).toBe(true);
      expect(expectOk(await clips.remove(clipId(1)))).toBe(false);
      expect(expectOk(await clips.findById(clipId(1)))).toBeNull();
    });

    it('lists the creator clips newest first with the video and its channel', async () => {
      await save(clip(1), clip(2, { videoId: VIDEO_IDS.b }), clip(3, { userId: OWNER_ID }));

      const entries = await list();

      expect(idsOf(entries)).toEqual([clipId(2), clipId(1)]);
      expect(entries[0]).toMatchObject({
        clip: { title: 'Clip 2', videoId: VIDEO_IDS.b, startMs: 10_000, endMs: 30_000 },
        video: { id: VIDEO_IDS.b, status: 'READY' },
        channel: { handle: 'owner' },
      });
    });

    it('walks on from a cursor, ties on the time broken by id', async () => {
      const at = new Date(BASE);
      await save(
        clip(1, { createdAt: at }),
        clip(2, { createdAt: at }),
        clip(3, { createdAt: at })
      );
      await save(clip(4, { createdAt: new Date(BASE - 60_000) }));

      const first = await list(2);
      const last = first[1]?.clip;
      const rest = last
        ? expectOk(
            await clips.listByCreator(CREATOR, {
              cursor: { createdAt: last.createdAt, id: last.id },
              limit: 5,
            })
          )
        : [];

      expect(idsOf(first)).toEqual([clipId(3), clipId(2), clipId(1)]);
      expect(idsOf(rest)).toEqual([clipId(1), clipId(4)]);
    });

    it('drops a clip of a video the creator may no longer watch, and of a deleted one', async () => {
      const hidden = '00000000-0000-7000-8000-0000000000f7';
      const deleted = '00000000-0000-7000-8000-0000000000f8';
      await subject.repositories.videos.create(publicVideo({ id: hidden, visibility: 'private' }));
      await subject.repositories.videos.create(publicVideo({ id: deleted, status: 'DELETED' }));
      await save(clip(1), clip(2, { videoId: hidden }), clip(3, { videoId: deleted }));

      expect(idsOf(await list())).toEqual([clipId(1)]);
    });
  });
}
