import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { ChannelImageKind } from '@vp/domain';
import {
  ErrorCodes,
  PermanentError,
  RETRY_CLASS,
  TransientError,
  storageUnavailable,
} from '@vp/errors';
import { type ChannelImageProbe, type MediaTools, planChannelImageVariants } from '@vp/ffmpeg';
import { createLogger } from '@vp/logger';
import { err } from '@vp/result';
import { channelImageUploadKey, channelImageVariantKey } from '@vp/storage';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createChannelImageProcessor } from '../channel-image';
import {
  AVATAR_PROBE,
  BANNER_CROPS,
  BANNER_PROBE,
  type ChannelImageJobArgs,
  channelImageJob,
  fakeMedia,
  IMMUTABLE,
  OWNER_ID,
  queueUpload,
} from './channel-image-harness';

const logger = createLogger({ format: 'json', service: 'channel-image-test', level: 'silent' });
describe('channel image stage', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let channelId: string;
  let tmpDir: string;
  let probe: ChannelImageProbe | Error;
  let rendered: number;

  const media = fakeMedia(
    () => probe,
    () => {
      rendered += 1;
    }
  );

  const processor = (overrides: Partial<MediaTools> = {}) =>
    createChannelImageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      tmpDir,
      media: { ...media, ...overrides },
    });

  const queued = (kind: ChannelImageKind = 'avatar', options: { raw?: boolean } = {}) =>
    queueUpload({ repositories, storage, channelId }, kind, options);

  const jobFor = (...args: ChannelImageJobArgs) => channelImageJob(channelId, ...args);

  const status = async (uploadId: string) =>
    expectOk(await repositories.channelImages.findById(uploadId))?.status;
  const channel = async () => expectOk(await repositories.channels.findById(channelId));
  const publicKeys = async () =>
    expectOk(await storage.listObjects({ bucket: 'public', prefix: '', maxKeys: 100 })).keys;
  const eventTypes = async () =>
    expectOk(await repositories.userEvents.listFrom(OWNER_ID, 0, 50)).map(({ type }) => type);

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    probe = AVATAR_PROBE;
    rendered = 0;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-channel-image-spec-'));
    channelId = expectOk(
      await repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    ).id;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('cuts four avatar sizes, uploads them immutable and commits the 128 px one', async () => {
    const id = await queued('avatar');
    const commit = vi.spyOn(repositories.channelImages, 'commit');

    const result = expectOk(await processor()(jobFor(id)));

    expect(result).toEqual({ type: 'channel-image', uploadId: id, version: 1, applied: true });
    const keys = ['48', '72', '128', '256'].map((v) =>
      channelImageVariantKey(channelId, 'avatar', v, 1)
    );
    expect((await publicKeys()).sort()).toEqual([...keys].sort());
    expect(expectOk(await storage.headObject('public', keys[2] as string))).toMatchObject({
      contentType: 'image/webp',
      cacheControl: IMMUTABLE,
    });
    const defaultUrl = `${STAGE_SETTINGS.cdn}/${keys[2]}`;
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(id, defaultUrl);
    expect(await channel()).toMatchObject({ avatarUrl: defaultUrl, avatarVersion: 1 });
    expect(await status(id)).toBe('ready');
    expect(await fs.readdir(tmpDir)).toEqual([]);
  });

  it('cuts six banner variants and commits desktop-1280', async () => {
    probe = BANNER_PROBE;
    const id = await queued('banner');
    const commit = vi.spyOn(repositories.channelImages, 'commit');

    expectOk(await processor()(jobFor(id, 'banner')));

    const names = planChannelImageVariants({ kind: 'banner', crops: BANNER_CROPS }).map(
      (v) => v.name
    );
    expect(names).toHaveLength(6);
    expect((await publicKeys()).sort()).toEqual(
      names.map((name) => channelImageVariantKey(channelId, 'banner', name, 1)).sort()
    );
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(
      id,
      `${STAGE_SETTINGS.cdn}/${channelImageVariantKey(channelId, 'banner', 'desktop-1280', 1)}`
    );
  });

  it.each([
    {
      scenario: 'a file ffprobe cannot decode',
      probed: new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'ffprobe error: Invalid data'),
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      scenario: 'dimensions past the cap',
      probed: new PermanentError(
        ErrorCodes.CORRUPT_CONTAINER,
        'Invalid image dimensions 9000x9000'
      ),
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      scenario: 'a file that is no still JPEG, PNG or WebP',
      probed: new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'Unsupported image codec "h264"'),
      code: ErrorCodes.UNSUPPORTED_CODEC,
    },
    {
      scenario: 'an image under the minimum',
      probed: { format: 'png', width: 120, height: 120 } satisfies ChannelImageProbe,
      code: ErrorCodes.IMAGE_TOO_SMALL,
    },
    {
      scenario: 'crops that do not fit the real dimensions',
      probed: { format: 'png', width: 300, height: 300 } satisfies ChannelImageProbe,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('fails the upload for good on $scenario and keeps the old image', async ({ probed, code }) => {
    probe = probed;
    const id = await queued('avatar');

    const failure = expectErr(await processor()(jobFor(id)));

    expect(failure.code).toBe(code);
    expect(RETRY_CLASS[failure.code]).toBe('permanent');
    expect(await status(id)).toBe('failed');
    expect(await publicKeys()).toEqual([]);
    expect(rendered).toBe(0);
    expect(await channel()).toMatchObject({ avatarUrl: null, avatarVersion: 0 });
    expect(await eventTypes()).toEqual(['channel.image.failed']);
  });

  it('fails the upload for good when its raw file never arrived', async () => {
    const id = await queued('avatar', { raw: false });

    const failure = expectErr(await processor()(jobFor(id)));

    expect(failure.code).toBe(ErrorCodes.SOURCE_MISSING);
    expect(await status(id)).toBe('failed');
  });

  it('fails a real file of random bytes through the real ffprobe', async () => {
    const id = await queued('avatar');
    await storage.uploadObject({
      bucket: 'raw',
      key: channelImageUploadKey(channelId, 'avatar', id),
      body: Buffer.from('definitely not an image'),
      contentType: 'image/png',
    });

    const failure = expectErr(
      await processor({ probeChannelImage: STAGE_SETTINGS.media.probeChannelImage })(jobFor(id))
    );

    expect(RETRY_CLASS[failure.code]).toBe('permanent');
    expect(await status(id)).toBe('failed');
  });

  it.each([
    {
      settled: 'ready',
      settle: async (id: string) => expectOk(await processor()(jobFor(id))),
    },
    {
      settled: 'failed',
      settle: async (id: string) =>
        expectOk(await repositories.channelImages.fail(id, 'unreadable')),
    },
    {
      settled: 'purged',
      settle: async (id: string) => expectOk(await repositories.channelImages.markPurged([id])),
    },
  ])('is a no-op for an upload already $settled', async ({ settle }) => {
    const id = await queued('avatar');
    await settle(id);
    const commit = vi.spyOn(repositories.channelImages, 'commit');
    rendered = 0;

    expectOk(await processor()(jobFor(id)));

    expect(commit).not.toHaveBeenCalled();
    expect(rendered).toBe(0);
  });

  it('answers a second run of the same job without a second commit or event', async () => {
    const id = await queued('avatar');
    const run = processor();
    expectOk(await run(jobFor(id)));
    const commit = vi.spyOn(repositories.channelImages, 'commit');

    expect(expectOk(await run(jobFor(id)))).toMatchObject({ applied: false });

    expect(commit).not.toHaveBeenCalled();
    expect(await eventTypes()).toEqual(['channel.image.ready']);
  });

  it('answers a missing upload with a no-op', async () => {
    expectOk(await processor()(jobFor(uuidv7())));
    expect(rendered).toBe(0);
  });

  it('supersedes an upload a newer version already replaced, leaving the live image alone', async () => {
    const older = await queued('avatar');
    const newer = await queued('avatar');
    expectOk(await processor()(jobFor(newer)));

    const result = expectOk(await processor()(jobFor(older)));

    expect(result).toMatchObject({ version: 1, applied: false });
    expect(await status(older)).toBe('superseded');
    expect(await channel()).toMatchObject({ avatarVersion: 2 });
  });

  it.each([
    {
      scenario: 'a storage error',
      code: ErrorCodes.STORAGE_UNAVAILABLE,
      fail: () => {
        vi.spyOn(storage, 'uploadObject').mockResolvedValue(
          err(storageUnavailable('uploadObject'))
        );
        return {};
      },
    },
    {
      scenario: 'an ffmpeg timeout',
      code: ErrorCodes.FFMPEG_TIMEOUT,
      fail: () => ({
        channelImage: () =>
          Promise.reject(new TransientError(ErrorCodes.FFMPEG_TIMEOUT, 'hard timeout')),
      }),
    },
  ])('keeps the upload queued after $scenario until the last attempt', async ({ code, fail }) => {
    const id = await queued('avatar');
    const run = processor(fail());
    const attempt = (attemptsMade: number) =>
      run(jobFor(id, 'avatar', { attemptsMade, opts: { attempts: 4 } }));

    expect(expectErr(await attempt(0)).code).toBe(code);
    expect(await status(id)).toBe('queued');
    expect(expectErr(await attempt(3)).code).toBe(code);
    expect(await status(id)).toBe('failed');
  });
});
