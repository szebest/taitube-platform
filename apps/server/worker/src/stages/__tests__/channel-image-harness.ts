import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { ChannelImageCompletion } from '@vp/core/repositories';
import type { BannerCrops, ChannelImageKind, CropRect } from '@vp/domain';
import type { ChannelImageProbe, MediaTools } from '@vp/ffmpeg';
import type { ChannelImageJob } from '@vp/job-contracts';
import { channelImageUploadKey } from '@vp/storage';
import { createMockJob } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';

export const OWNER_ID = '00000000-0000-7000-8000-00000000a001';
export const IMMUTABLE = 'public, max-age=31536000, immutable';
const AVATAR_CROP: CropRect = { x: 0, y: 0, width: 400, height: 400 };
export const BANNER_CROPS: BannerCrops = {
  desktop: { x: 0, y: 0, width: 2400, height: 400 },
  mobile: { x: 0, y: 0, width: 1500, height: 500 },
  tv: { x: 0, y: 0, width: 1600, height: 900 },
};
export const AVATAR_PROBE: ChannelImageProbe = { format: 'png', width: 800, height: 800 };
export const BANNER_PROBE: ChannelImageProbe = { format: 'jpeg', width: 2560, height: 1440 };

function completionFor(kind: ChannelImageKind): ChannelImageCompletion {
  return kind === 'avatar'
    ? { width: 800, height: 800, crops: { kind: 'avatar', crop: AVATAR_CROP } }
    : { width: 2560, height: 1440, crops: { kind: 'banner', crops: BANNER_CROPS } };
}

export function fakeMedia(
  probed: () => ChannelImageProbe | Error,
  onRender: () => void
): MediaTools {
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

export const channelImageJob = (
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

export async function queueUpload(
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
