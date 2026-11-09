import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { CHANNEL_IMAGE_RETENTION_DAYS, type ChannelImageKind } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { storageUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { channelImageUploadKey, channelImageVariantKey } from '@vp/storage';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { type PurgeChannelImagesOptions, runPurgeChannelImages } from '../purge-channel-images';

const OWNER_ID = '00000000-0000-7000-8000-00000000a001';
const CROP = { x: 0, y: 0, width: 400, height: 400 };

describe('housekeeping: purge-channel-images', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let channelId: string;

  const purge = (days: number, overrides: Partial<PurgeChannelImagesOptions> = {}) =>
    runPurgeChannelImages({
      repositories,
      storage,
      rawBucket: 'raw',
      publicBucket: 'public',
      retentionDays: CHANNEL_IMAGE_RETENTION_DAYS,
      scanLimit: 100,
      now: () => Date.now() + days * MS_PER_DAY,
      ...overrides,
    });

  const put = async (bucket: string, key: string) =>
    expectOk(await storage.uploadObject({ bucket, key, body: key, contentType: 'image/webp' }));

  async function upload(kind: ChannelImageKind = 'avatar') {
    const id = uuidv7();
    await repositories.channelImages.create({
      id,
      channelId,
      uploadedBy: OWNER_ID,
      kind,
      contentType: 'image/png',
      sizeBytes: 100,
    });
    await put('raw', channelImageUploadKey(channelId, kind, id));
    return id;
  }

  async function committed(kind: ChannelImageKind = 'avatar') {
    const id = await upload(kind);
    const queued = expectOk(
      await repositories.channelImages.queue(id, {
        width: 800,
        height: 800,
        crops: { kind: 'avatar', crop: CROP },
      })
    );
    const version = queued?.version ?? 0;
    await put('public', channelImageVariantKey(channelId, kind, '128', version));
    expectOk(await repositories.channelImages.commit(id, 'https://cdn/x.webp'));
    return { id, version };
  }

  const keys = async (bucket: string) =>
    expectOk(await storage.listObjects({ bucket, prefix: '', maxKeys: 100 })).keys;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    channelId = expectOk(
      await repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    ).id;
  });

  it('removes the raw file of an abandoned upload and marks it purged', async () => {
    const id = await upload();

    expect(expectOk(await purge(8))).toEqual({ purgedCount: 1 });

    expect(await keys('raw')).toEqual([]);
    expect(expectOk(await repositories.channelImages.findById(id))?.status).toBe('purged');
  });

  it('keeps an upload inside its retention window', async () => {
    const id = await upload();

    expect(expectOk(await purge(6))).toEqual({ purgedCount: 0 });

    expect(await keys('raw')).toHaveLength(1);
    expect(expectOk(await repositories.channelImages.findById(id))?.status).toBe('issued');
  });

  it('removes the variants of a version a newer one replaced and keeps the live one', async () => {
    const old = await committed();
    const live = await committed();

    expect(expectOk(await purge(8))).toEqual({ purgedCount: 1 });

    expect(await keys('public')).toEqual([
      channelImageVariantKey(channelId, 'avatar', '128', live.version),
    ]);
    expect(expectOk(await repositories.channelImages.findById(old.id))?.status).toBe('purged');
    expect(expectOk(await repositories.channelImages.findById(live.id))?.status).toBe('ready');
  });

  it('reports a storage failure and leaves the upload for the next run', async () => {
    await upload();
    const failing = new InMemoryStorageClient();
    failing.deleteObject = async () => err(storageUnavailable('deleteObject'));

    expectErr(await purge(8, { storage: failing }));

    expect(await keys('raw')).toHaveLength(1);
    expect(expectOk(await purge(8))).toEqual({ purgedCount: 1 });
  });

  it('takes no more than the scan limit in one run', async () => {
    await upload();
    await upload();

    expect(expectOk(await purge(8, { scanLimit: 1 }))).toEqual({ purgedCount: 1 });
  });
});
