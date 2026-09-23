import type { UploadRepository } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const UPLOAD_ID = '00000000-0000-7000-8000-000000000401';
const UNKNOWN_UPLOAD_ID = '00000000-0000-7000-8000-0000000004ff';

export function describeUploadRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('UploadRepository contract', () => {
    let subject: RepositoriesSubject;
    let uploads: UploadRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      uploads = subject.repositories.uploads;
      expectOk(
        await subject.repositories.videos.create(
          publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' })
        )
      );
      expectOk(
        await uploads.create({
          id: UPLOAD_ID,
          videoId: VIDEO_IDS.a,
          strategy: 'multipart',
          declaredSizeBytes: 1024,
          declaredContentType: 'video/mp4',
          partSizeBytes: 512,
          partsExpected: 2,
          multipartUploadId: 's3-upload-1',
          expiresAt: new Date(Date.now() + 3_600_000),
        })
      );
    });

    it('round-trips an upload and defaults its status to OPEN', async () => {
      expect(expectOk(await uploads.findById(UPLOAD_ID))).toMatchObject({
        videoId: VIDEO_IDS.a,
        strategy: 'multipart',
        status: 'OPEN',
        partSizeBytes: 512,
        partsExpected: 2,
        declaredSizeBytes: 1024,
        declaredContentType: 'video/mp4',
        multipartUploadId: 's3-upload-1',
      });
    });

    it('finds the upload of a video and reports absence as ok(null), not as a failure', async () => {
      expect(expectOk(await uploads.findByVideoId(VIDEO_IDS.a))?.id).toBe(UPLOAD_ID);
      expect(expectOk(await uploads.findByVideoId(VIDEO_IDS.f))).toBeNull();
      expect(expectOk(await uploads.findById(UNKNOWN_UPLOAD_ID))).toBeNull();
    });

    it('joins the upload to its video', async () => {
      const joined = expectOk(await uploads.findWithVideo(UPLOAD_ID));

      expect(joined?.upload.id).toBe(UPLOAD_ID);
      expect(joined?.video.id).toBe(VIDEO_IDS.a);
      expect(expectOk(await uploads.findWithVideo(UNKNOWN_UPLOAD_ID))).toBeNull();
    });

    it('transitions the status and reports an unknown upload as ok(null)', async () => {
      const completed = expectOk(await uploads.updateStatus(UPLOAD_ID, 'COMPLETED'));

      expect(completed?.status).toBe('COMPLETED');
      expect(expectOk(await uploads.findById(UPLOAD_ID))?.status).toBe('COMPLETED');
      expect(expectOk(await uploads.updateStatus(UNKNOWN_UPLOAD_ID, 'ABORTED'))).toBeNull();
    });
  });
}
