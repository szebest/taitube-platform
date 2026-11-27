import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createLogger } from '@kit/logger';
import { assertNever } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { ChannelImageCompletion } from '@vp/core/repositories';
import type { BannerCrops, ChannelImageKind, CropRect } from '@vp/domain';
import type { ChannelImageProbe, MediaTools } from '@vp/ffmpeg';
import type { ChannelImageJob } from '@vp/job-contracts';
import { channelImageUploadKey } from '@vp/storage';
import { createMockJob } from '@vp/testing-fixtures';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createChannelImageProcessor } from '../channel-image';

const OWNER_ID = '00000000-0000-7000-8000-00000000a001';
export const IMMUTABLE = 'public, max-age=31536000, immutable';
const AVATAR_CROP: CropRect = { x: 0, y: 0, width: 400, height: 400 };
const PLAYLIST_COVER_CROP: CropRect = { x: 0, y: 0, width: 1600, height: 900 };
const POST_IMAGE_CROP: CropRect = { x: 0, y: 0, width: 3000, height: 2000 };
export const BANNER_CROPS: BannerCrops = {
  desktop: { x: 0, y: 0, width: 2400, height: 400 },
  mobile: { x: 0, y: 0, width: 1500, height: 500 },
  tv: { x: 0, y: 0, width: 1600, height: 900 },
};
const AVATAR_PROBE: ChannelImageProbe = { format: 'png', width: 800, height: 800 };
export const BANNER_PROBE: ChannelImageProbe = { format: 'jpeg', width: 2560, height: 1440 };

export const POST_IMAGE_PROBE: ChannelImageProbe = { format: 'jpeg', width: 3000, height: 2000 };

function completionFor(kind: ChannelImageKind): ChannelImageCompletion {
  switch (kind) {
    case 'avatar':
      return { width: 800, height: 800, crops: { kind, crop: AVATAR_CROP } };
    case 'banner':
      return { width: 2560, height: 1440, crops: { kind, crops: BANNER_CROPS } };
    case 'playlist-cover':
      return { width: 1600, height: 900, crops: { kind, crop: PLAYLIST_COVER_CROP } };
    case 'post-image':
    case 'page-image':
      return { width: 3000, height: 2000, crops: { kind, crop: POST_IMAGE_CROP } };
    default:
      return assertNever(kind, 'ChannelImageKind');
  }
}

function fakeMedia(probed: () => ChannelImageProbe | Error, onRender: () => void): MediaTools {
  return {
    ...STAGE_SETTINGS.media,
    probeChannelImage: async () => {
      const result = probed();
      if (result instanceof Error) throw result;
      return result;
    },
    channelImage: async ({ outputDir, variants }) => {
      onRender();
      return Promise.all(
        variants.map(async ({ name }) => {
          const file = path.join(outputDir, `${name}.webp`);
          await fs.writeFile(file, `webp ${name}`);
          return { name, path: file };
        })
      );
    },
  };
}

export type ChannelImageJobArgs = [
  uploadId: string,
  kind?: ChannelImageKind,
  overrides?: Partial<QueueJob<ChannelImageJob>>,
];

const channelImageJob = (
  channelId: string,
  ...[uploadId, kind = 'avatar', overrides = {}]: ChannelImageJobArgs
) =>
  createMockJob<ChannelImageJob>(
    'thumbnail',
    { type: 'channel-image', uploadId, channelId, kind, traceparent: '00-01' },
    { id: `${uploadId}--channel-image`, ...overrides }
  );

interface UploadContext {
  repositories: InMemoryRepositories;
  storage: InMemoryStorageClient;
  channelId: string;
}

async function queueUpload(
  { repositories, storage, channelId }: UploadContext,
  kind: ChannelImageKind,
  { raw = true } = {}
) {
  const id = uuidv7();
  await repositories.channelImages.create({
    id,
    channelId,
    uploadedBy: OWNER_ID,
    kind,
    contentType: 'image/png',
    sizeBytes: 100,
  });
  if (raw) {
    await storage.uploadObject({
      bucket: 'raw',
      key: channelImageUploadKey(channelId, kind, id),
      body: 'raw bytes',
      contentType: 'image/png',
    });
  }
  expectOk(await repositories.channelImages.queue(id, completionFor(kind)));
  return id;
}

const logger = createLogger({ format: 'json', service: 'channel-image-test', level: 'silent' });

export function useChannelImageStage() {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let channelId: string;
  let tmpDir: string;
  let probe: ChannelImageProbe | Error = AVATAR_PROBE;
  let rendered = 0;

  const media = fakeMedia(
    () => probe,
    () => {
      rendered += 1;
    }
  );

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

  return {
    get repositories() {
      return repositories;
    },
    get storage() {
      return storage;
    },
    get channelId() {
      return channelId;
    },
    get tmpDir() {
      return tmpDir;
    },
    get probe() {
      return probe;
    },
    set probe(next: ChannelImageProbe | Error) {
      probe = next;
    },
    get rendered() {
      return rendered;
    },
    set rendered(next: number) {
      rendered = next;
    },
    processor: (overrides: Partial<MediaTools> = {}) =>
      createChannelImageProcessor({
        ...STAGE_SETTINGS,
        repositories,
        storage,
        logger,
        tmpDir,
        media: { ...media, ...overrides },
      }),
    queued: (kind: ChannelImageKind = 'avatar', options: { raw?: boolean } = {}) =>
      queueUpload({ repositories, storage, channelId }, kind, options),
    jobFor: (...args: ChannelImageJobArgs) => channelImageJob(channelId, ...args),
    status: async (uploadId: string) =>
      expectOk(await repositories.channelImages.findById(uploadId))?.status,
    channel: async () => expectOk(await repositories.channels.findById(channelId)),
    publicKeys: async () =>
      expectOk(await storage.listObjects({ bucket: 'public', prefix: '', maxKeys: 100 })).keys,
    eventTypes: async () =>
      expectOk(await repositories.userEvents.listFrom(OWNER_ID, 0, 50)).map(({ type }) => type),
  };
}
