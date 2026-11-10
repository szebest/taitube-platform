import {
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { ActingChannel, ChannelImageKind } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ids } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { channelImageUploadKey } from '@vp/storage';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelImagePipelineService } from '../channel-image-pipeline-service';
import { ownerActing } from './service-deps';

const OWNER_ID = '018f0000-0000-7000-8000-000000000001';
const MEMBER_ID = '018f0000-0000-7000-8000-000000000003';
const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';
const USER: UserContext = { id: OWNER_ID, role: 'CREATOR' };
const MEMBER: UserContext = { id: MEMBER_ID, role: 'CREATOR' };
const ACTING = ownerActing(OWNER_ID, CHANNEL_ID);
const MODERATOR: ActingChannel = { channelId: CHANNEL_ID, ownerId: OWNER_ID, role: 'moderator' };
const AVATAR_CROP = { x: 0, y: 0, width: 400, height: 400 };
const BANNER_CROPS = {
  desktop: { x: 0, y: 0, width: 2400, height: 400 },
  mobile: { x: 0, y: 0, width: 1500, height: 500 },
  tv: { x: 0, y: 0, width: 1600, height: 900 },
};
const SIZE = 5000;

describe('ChannelImagePipelineService', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let queue: InMemoryJobQueue;
  let service: ChannelImagePipelineService;

  const prepare = async (kind: ChannelImageKind = 'avatar', request = {}) =>
    service.prepare(USER, ACTING, {
      kind,
      contentType: 'image/png',
      sizeBytes: SIZE,
      ...request,
    });

  async function uploaded(kind: ChannelImageKind = 'avatar', body = Buffer.alloc(SIZE)) {
    const { uploadId } = expectOk(await prepare(kind));
    await storage.uploadObject({
      bucket: 'raw',
      key: channelImageUploadKey(CHANNEL_ID, kind, uploadId),
      body,
      contentType: 'image/png',
    });
    return uploadId;
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    storage = new InMemoryStorageClient();
    queue = new InMemoryJobQueue('thumbnail');
    service = new ChannelImagePipelineService({
      channels: repositories.channels,
      images: repositories.channelImages,
      storage,
      rawBucket: 'raw',
      presignedUrlTtlSeconds: 900,
      queue,
    });
    expectOk(
      await repositories.users.upsert({ id: OWNER_ID, email: 'o@example.com', tier: 'free' })
    );
    expectOk(
      await repositories.users.upsert({ id: MEMBER_ID, email: 'm@example.com', tier: 'free' })
    );
    expectOk(
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
  });

  describe('prepare', () => {
    it('records the upload and presigns a put into the raw bucket', async () => {
      const prepared = expectOk(await prepare('banner'));

      expect(prepared.uploadUrl).toContain(
        channelImageUploadKey(CHANNEL_ID, 'banner', prepared.uploadId)
      );
      expect(expectOk(await repositories.channelImages.findById(prepared.uploadId))).toMatchObject({
        channelId: CHANNEL_ID,
        kind: 'banner',
        status: 'issued',
        sizeBytes: SIZE,
      });
    });

    it.each([
      {
        scenario: 'a content type that is no image',
        request: { contentType: 'application/pdf' },
        code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      },
      {
        scenario: 'an avatar over 2 MB',
        request: { sizeBytes: 2 * 1024 * 1024 + 1 },
        code: ErrorCodes.UPLOAD_TOO_LARGE,
      },
    ])('refuses $scenario', async ({ request, code }) => {
      expect(expectErr(await prepare('avatar', request)).code).toBe(code);
    });

    it('lets a banner be larger than an avatar may be', async () => {
      expectOk(await prepare('banner', { sizeBytes: 3 * 1024 * 1024 }));
    });

    it('refuses a role that may not edit the channel', async () => {
      const failure = expectErr(
        await service.prepare(MEMBER, MODERATOR, {
          kind: 'avatar',
          contentType: 'image/png',
          sizeBytes: SIZE,
        })
      );

      expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
    });
  });

  describe('complete', () => {
    it('queues the job under the upload id and answers its version', async () => {
      const uploadId = await uploaded('avatar');

      const queued = expectOk(
        await service.complete(USER, ACTING, 'avatar', {
          uploadId,
          width: 800,
          height: 800,
          crop: AVATAR_CROP,
        })
      );

      expect(queued).toEqual({ uploadId, version: 1 });
      expect(expectOk(await queue.getJobState(ids.channelImage(uploadId)))).toBe('waiting');
    });

    it('takes three crops for a banner', async () => {
      const uploadId = await uploaded('banner');

      expectOk(
        await service.complete(USER, ACTING, 'banner', {
          uploadId,
          width: 2560,
          height: 1440,
          crops: BANNER_CROPS,
        })
      );

      expect(expectOk(await repositories.channelImages.findById(uploadId))).toMatchObject({
        status: 'queued',
        crops: { kind: 'banner', crops: BANNER_CROPS },
      });
    });

    it('answers the same version when the same upload is completed again', async () => {
      const uploadId = await uploaded('avatar');
      const input = { uploadId, width: 800, height: 800, crop: AVATAR_CROP };

      const first = expectOk(await service.complete(USER, ACTING, 'avatar', input));
      const second = expectOk(await service.complete(USER, ACTING, 'avatar', input));

      expect(second).toEqual(first);
    });

    it.each([
      {
        scenario: 'an avatar without its crop',
        input: { width: 800, height: 800 },
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'an image under the minimum',
        input: { width: 100, height: 100, crop: AVATAR_CROP },
        code: ErrorCodes.IMAGE_TOO_SMALL,
      },
      {
        scenario: 'a crop outside the image',
        input: { width: 300, height: 300, crop: AVATAR_CROP },
        code: ErrorCodes.IMAGE_TOO_SMALL,
      },
    ])('refuses $scenario', async ({ input, code }) => {
      const uploadId = await uploaded('avatar');

      const failure = expectErr(
        await service.complete(USER, ACTING, 'avatar', { uploadId, ...input })
      );

      expect([code, ErrorCodes.VALIDATION_FAILED]).toContain(failure.code);
    });

    it('refuses a file that never arrived and one of another size', async () => {
      const { uploadId: missing } = expectOk(await prepare('avatar'));
      const wrongSize = await uploaded('avatar', Buffer.alloc(SIZE + 1));
      const input = { width: 800, height: 800, crop: AVATAR_CROP };

      expect(
        expectErr(await service.complete(USER, ACTING, 'avatar', { uploadId: missing, ...input }))
          .code
      ).toBe(ErrorCodes.IMAGE_UPLOAD_NOT_FOUND);
      expect(
        expectErr(await service.complete(USER, ACTING, 'avatar', { uploadId: wrongSize, ...input }))
          .code
      ).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);
    });

    it('treats an upload of another kind or channel as not found', async () => {
      const uploadId = await uploaded('avatar');
      const input = { uploadId, width: 2560, height: 1440, crops: BANNER_CROPS };

      expect(expectErr(await service.complete(USER, ACTING, 'banner', input)).code).toBe(
        ErrorCodes.IMAGE_UPLOAD_NOT_FOUND
      );
    });

    it('refuses a role that may not edit the channel', async () => {
      const uploadId = await uploaded('avatar');

      const failure = expectErr(
        await service.complete(MEMBER, MODERATOR, 'avatar', {
          uploadId,
          width: 800,
          height: 800,
          crop: AVATAR_CROP,
        })
      );

      expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
    });
  });
});
