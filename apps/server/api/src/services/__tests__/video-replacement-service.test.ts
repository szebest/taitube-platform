import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { replacementSourceKey } from '@vp/storage';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { VideoReplacementService } from '../video-replacement-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000e1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000e2', role: 'USER' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000ea';
const NOW = Date.parse('2026-03-10T00:00:00.000Z');
const FILE = { filename: 'retake.mov', sizeBytes: 2_048, contentType: 'video/quicktime' };

describe('apps/server/api/services: video replacement', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let replacements: VideoReplacementService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    replacements = new VideoReplacementService({
      videos: repositories.videos,
      generations: repositories.videoGenerations,
      storage,
      rawBucket: 'raw',
      maxUploadBytes: 10_000,
      presignedUrlTtlSeconds: 600,
      traceparent: () => '00-trace-span-01',
      now: () => NOW,
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        channelId: await seedPrimaryChannel(repositories, OWNER.id),
        visibility: 'private',
        status: 'READY',
        sourceKey: `raw/${VIDEO_ID}/source.mp4`,
        durationMs: 60_000,
        generation: 3,
      })
    );
  });

  it('numbers the replacement past the playing generation and presigns its own raw key', async () => {
    const put = vi.spyOn(storage, 'createPresignedPutUrl');

    const upload = expectOk(await replacements.start(OWNER, VIDEO_ID, FILE));

    expect(upload).toMatchObject({ generation: 4, expiresAt: '2026-03-10T00:10:00.000Z' });
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'raw',
        key: replacementSourceKey(VIDEO_ID, 4, '.mov'),
        contentLength: FILE.sizeBytes,
      })
    );
  });

  it('queues the render once the file is in the raw bucket, through the outbox', async () => {
    const enqueue = vi.spyOn(repositories.outbox, 'enqueue');
    expectOk(await replacements.start(OWNER, VIDEO_ID, FILE));
    expectOk(
      await storage.uploadObject({
        bucket: 'raw',
        key: replacementSourceKey(VIDEO_ID, 4, '.mov'),
        body: 'x',
        contentType: FILE.contentType,
      })
    );

    expect(expectOk(await replacements.complete(OWNER, VIDEO_ID, 4))).toEqual({
      generation: 4,
      status: 'rendering',
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          job: expect.objectContaining({
            data: { videoId: VIDEO_ID, generation: 4, traceparent: '00-trace-span-01' },
          }),
        }),
      })
    );
    expect(expectErr(await replacements.complete(OWNER, VIDEO_ID, 4)).code).toBe(
      ErrorCodes.REPLACEMENT_NOT_UPLOADED
    );
  });

  it.each([
    { scenario: 'a generation that was never opened', generation: 9 },
    { scenario: 'a file that never landed', generation: 4 },
  ])('refuses to render $scenario', async ({ generation }) => {
    expectOk(await replacements.start(OWNER, VIDEO_ID, FILE));

    expect(expectErr(await replacements.complete(OWNER, VIDEO_ID, generation)).code).toBe(
      ErrorCodes.REPLACEMENT_NOT_UPLOADED
    );
  });

  it('hides a private video from a caller who cannot read it', async () => {
    expect(expectErr(await replacements.start(STRANGER, VIDEO_ID, FILE)).code).toBe(
      ErrorCodes.VIDEO_NOT_FOUND
    );
  });
});
