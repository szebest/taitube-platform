import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { ChannelImageUpload } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { type Result, err, isErr, ok } from '@vp/result';
import { channelImageUploadKey, channelImageVersionPrefix } from '@vp/storage';

export const CHANNEL_IMAGE_RETENTION_DAYS = 7;

export interface PurgeChannelImagesOptions {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket: string;
  publicBucket: string;
  retentionDays: number;
  scanLimit: number;
  now: () => number;
  logger?: Logger;
}

export interface PurgeChannelImagesResult {
  purgedCount: number;
}

type PurgeChannelImagesFailure = DatabaseUnavailable | StorageUnavailable;

/**
 * Removes the raw file of an upload that has been settled for the retention window and every
 * variant of a version nothing shows any more, then marks it `purged`. An upload whose files are
 * not all gone stays listed, so the next run finishes it.
 */
export async function runPurgeChannelImages(
  options: PurgeChannelImagesOptions
): Promise<Result<PurgeChannelImagesResult, PurgeChannelImagesFailure>> {
  const { repositories, storage, rawBucket, publicBucket, scanLimit, now, logger } = options;
  const images = repositories.channelImages;

  const listed = await images.listPurgeable(
    new Date(now() - options.retentionDays * MS_PER_DAY),
    scanLimit
  );
  if (isErr(listed)) return listed;

  const removeFiles = async ({
    id,
    channelId,
    kind,
    version,
  }: ChannelImageUpload): Promise<Result<void, StorageUnavailable>> => {
    const raw = await storage.deleteObject(rawBucket, channelImageUploadKey(channelId, kind, id));
    if (isErr(raw) || version === null) return raw;
    const variants = await storage.purgePrefix(
      publicBucket,
      channelImageVersionPrefix(channelId, kind, version)
    );
    return isErr(variants) ? variants : ok();
  };

  const purged: string[] = [];
  let failure: StorageUnavailable | null = null;
  for (const upload of listed.value) {
    const removed = await removeFiles(upload);
    if (isErr(removed)) {
      failure = removed.error;
      break;
    }
    purged.push(upload.id);
  }

  if (purged.length > 0) {
    const marked = await images.markPurged(purged);
    if (isErr(marked)) return marked;
  }
  logger?.info({ purgedCount: purged.length }, 'purged channel image files past their retention');
  return failure ? err(failure) : ok({ purgedCount: purged.length });
}
