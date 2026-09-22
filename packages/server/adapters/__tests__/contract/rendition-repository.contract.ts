import type { RenditionRepository } from '@vp/core/repositories';
import { VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const RENDITION_720_ID = '00000000-0000-7000-8000-000000000601';
const RENDITION_1080_ID = '00000000-0000-7000-8000-000000000602';

export function describeRenditionRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('RenditionRepository contract', () => {
    let subject: RepositoriesSubject;
    let renditions: RenditionRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      renditions = subject.repositories.renditions;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));

      await renditions.create({
        id: RENDITION_720_ID,
        videoId: VIDEO_IDS.a,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2500,
        audioBitrateKbps: 128,
      });
      await renditions.create({
        id: RENDITION_1080_ID,
        videoId: VIDEO_IDS.b,
        name: '1080p',
        width: 1920,
        height: 1080,
        videoBitrateKbps: 5000,
        audioBitrateKbps: 192,
        status: 'DONE',
      });
    });

    it('defaults a new rendition to PENDING', async () => {
      const [stored] = await renditions.findByVideoId(VIDEO_IDS.a);
      expect(stored).toMatchObject({
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2500,
        audioBitrateKbps: 128,
        status: 'PENDING',
      });
    });

    it('lists by one video and by several at once', async () => {
      expect((await renditions.findByVideoId(VIDEO_IDS.b)).map((r) => r.name)).toEqual(['1080p']);
      expect(await renditions.findByVideoId(VIDEO_IDS.f)).toEqual([]);

      const both = await renditions.findByVideoIds([VIDEO_IDS.a, VIDEO_IDS.b]);
      expect(both.map((r) => r.name).sort()).toEqual(['1080p', '720p']);
      expect(await renditions.findByVideoIds([])).toEqual([]);
    });

    it('patches a rendition addressed by video and name', async () => {
      const updated = await renditions.update(VIDEO_IDS.a, '720p', {
        status: 'DONE',
        segmentCount: 12,
        bytes: 4096,
        playlistKey: `videos/${VIDEO_IDS.a}/hls/720p/index.m3u8`,
      });

      expect(updated).toMatchObject({ status: 'DONE', segmentCount: 12, bytes: 4096 });
      expect((await renditions.findByVideoId(VIDEO_IDS.a))[0]?.status).toBe('DONE');
    });

    it('returns null when the rendition to patch does not exist', async () => {
      expect(await renditions.update(VIDEO_IDS.a, '2160p', { status: 'DONE' })).toBeNull();
    });
  });
}
