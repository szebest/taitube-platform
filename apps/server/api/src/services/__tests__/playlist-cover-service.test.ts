import { expectErr, expectOk } from '@kit/testing/result';
import {
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { channelImageUploadKey, channelImageVariantKey } from '@vp/storage';
import { ChannelImagePipelineService } from '../channel-image-pipeline-service';
import { PlaylistCoverService } from '../playlist-cover-service';

const OWNER: UserContext = { id: '018f0000-0000-7000-8000-0000000000c1', role: 'USER' };
const STRANGER: UserContext = { id: '018f0000-0000-7000-8000-0000000000c2', role: 'USER' };
const CHANNEL_ID = '018f0000-0000-7000-8000-0000000000c3';
const WATCH_LATER = '018f0000-0000-7000-8000-0000000000c4';
const REQUEST = { contentType: 'image/png', sizeBytes: 5000 };
const UPLOADED = { width: 1600, height: 900, crop: { x: 0, y: 0, width: 1600, height: 900 } };

describe('PlaylistCoverService', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let service: PlaylistCoverService;
  let playlistId: string;

  async function uploaded(): Promise<string> {
    const { uploadId } = expectOk(await service.prepare(OWNER, playlistId, REQUEST));
    await storage.uploadObject({
      bucket: 'raw',
      key: channelImageUploadKey(CHANNEL_ID, 'playlist-cover', uploadId),
      body: Buffer.alloc(REQUEST.sizeBytes),
      contentType: REQUEST.contentType,
    });
    return uploadId;
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    service = new PlaylistCoverService({
      playlists: repositories.playlists,
      channels: repositories.channels,
      images: repositories.channelImages,
      pipeline: new ChannelImagePipelineService({
        channels: repositories.channels,
        images: repositories.channelImages,
        storage,
        rawBucket: 'raw',
        presignedUrlTtlSeconds: 900,
        queue: new InMemoryJobQueue('thumbnail'),
      }),
    });
    for (const { id } of [OWNER, STRANGER]) {
      expectOk(await repositories.users.upsert({ id, email: `${id}@example.com`, tier: 'free' }));
    }
    expectOk(
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    playlistId = expectOk(
      await repositories.playlists.create({
        id: '018f0000-0000-7000-8000-0000000000c5',
        ownerId: OWNER.id,
        title: 'Mix',
        description: '',
        visibility: 'public',
      })
    ).id;
    expectOk(
      await repositories.playlists.provisionWatchLater({ id: WATCH_LATER, ownerId: OWNER.id })
    );
  });

  it("records the upload as a playlist cover under the owner's primary channel", async () => {
    const { uploadId } = expectOk(await service.prepare(OWNER, playlistId, REQUEST));

    expect(expectOk(await repositories.channelImages.findById(uploadId))).toMatchObject({
      channelId: CHANNEL_ID,
      uploadedBy: OWNER.id,
      kind: 'playlist-cover',
      status: 'issued',
    });
  });

  it.each([
    {
      scenario: 'a stranger',
      actor: STRANGER,
      target: () => playlistId,
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'Watch Later',
      actor: OWNER,
      target: () => WATCH_LATER,
      code: ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE,
    },
    {
      scenario: 'a playlist that does not exist',
      actor: OWNER,
      target: () => '018f0000-0000-7000-8000-0000000000c9',
      code: ErrorCodes.PLAYLIST_NOT_FOUND,
    },
  ])('refuses a cover for $scenario with $code', async ({ actor, target, code }) => {
    expect(expectErr(await service.prepare(actor, target(), REQUEST)).code).toBe(code);
    expect(
      expectErr(await service.complete(actor, target(), { uploadId: WATCH_LATER, ...UPLOADED }))
        .code
    ).toBe(code);
  });

  it('refuses a cover crop that is not 16:9', async () => {
    const uploadId = await uploaded();

    const failure = expectErr(
      await service.complete(OWNER, playlistId, {
        uploadId,
        ...UPLOADED,
        crop: { x: 0, y: 0, width: 900, height: 900 },
      })
    );

    expect(failure).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, field: 'crop' });
  });

  it('names the kept variant of a cover only once its job is done', async () => {
    const uploadId = await uploaded();
    const { version } = expectOk(
      await service.complete(OWNER, playlistId, { uploadId, ...UPLOADED })
    );
    const queued = expectOk(await service.readyCoverKey(OWNER.id, uploadId));

    expectOk(await repositories.channelImages.commit(uploadId, 'https://cdn.example/cover.webp'));

    expect(queued).toBeNull();
    expect(expectOk(await service.readyCoverKey(OWNER.id, uploadId))).toBe(
      channelImageVariantKey(CHANNEL_ID, 'playlist-cover', '1280', version)
    );
    expect(expectOk(await service.readyCoverKey(STRANGER.id, uploadId))).toBeNull();
  });

  it('names nothing for an upload that is no cover', async () => {
    expect(expectOk(await service.readyCoverKey(OWNER.id, WATCH_LATER))).toBeNull();
  });
});
