import * as path from 'node:path';
import { type Result, err, isErr, ok } from '@kit/result';
import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { GenerationPlayback, VideoEditList, VideoGeneration } from '@vp/domain';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  type StorageUnavailable,
  mediaFailure,
} from '@vp/errors';
import { LadderEntry } from '@vp/job-contracts';
import { renditionPlaylistKey, renditionPrefix } from '@vp/storage';
import { z } from 'zod';

export interface SourceDeps {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket: string;
  publicBucket: string;
}

/** What a render reads: a local file to encode from, and for an edit the ladder and list to keep. */
export type GenerationSource =
  | { type: 'upload'; path: string }
  | { type: 'edit'; path: string; ladder: LadderEntry[]; edits: VideoEditList };

export type SourceFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

const missing = (message: string) =>
  err(mediaFailure('apply-edits', ErrorCodes.SOURCE_MISSING, message));

async function downloadUpload(
  deps: SourceDeps,
  sourceKey: string,
  dir: string
): Promise<Result<GenerationSource, SourceFailure>> {
  const local = path.join(dir, path.basename(sourceKey));
  const downloaded = await deps.storage.downloadObject(deps.rawBucket, sourceKey, local);
  if (isErr(downloaded)) return downloaded;
  return downloaded.value
    ? ok({ type: 'upload', path: local })
    : missing(`No upload at ${sourceKey}`);
}

/** The playback of the base: its own row once it retired, the video's while it still plays. */
async function basePlayback(
  deps: SourceDeps,
  videoId: string,
  base: number
): Promise<Result<GenerationPlayback | null, DatabaseUnavailable>> {
  const rows = await deps.repositories.videoGenerations.list(videoId);
  if (isErr(rows)) return rows;
  const retired = rows.value.find(({ generation }) => generation === base)?.playback;
  if (retired) return ok(retired);
  const video = await deps.repositories.videos.findById(videoId);
  if (isErr(video)) return video;
  const playing = video.value;
  if (playing?.generation !== base || !playing.masterPlaylistKey || playing.durationMs === null) {
    return ok(null);
  }
  return ok({
    masterPlaylistKey: playing.masterPlaylistKey,
    durationMs: playing.durationMs,
    width: playing.width ?? 0,
    height: playing.height ?? 0,
    fps: playing.fps ?? null,
    ladder: playing.ladder,
  });
}

/** Every object of the base's top rendition, so ffmpeg reads its playlist from disk. */
async function downloadRendition(
  deps: SourceDeps,
  videoId: string,
  base: number,
  rendition: string,
  dir: string
): Promise<Result<boolean, StorageUnavailable>> {
  const prefix = renditionPrefix(videoId, rendition, base);
  let continuationToken: string | undefined;
  do {
    const page = await deps.storage.listObjects({
      bucket: deps.publicBucket,
      prefix,
      continuationToken,
    });
    if (isErr(page)) return page;
    for (const key of page.value.keys) {
      const fetched = await deps.storage.downloadObject(
        deps.publicBucket,
        key,
        path.join(dir, key.slice(prefix.length))
      );
      if (isErr(fetched)) return fetched;
      if (!fetched.value) return ok(false);
    }
    continuationToken = page.value.isTruncated ? page.value.nextContinuationToken : undefined;
  } while (continuationToken);
  return ok(true);
}

/**
 * Fetches what the generation renders from into `dir`: a replacement's upload from the raw bucket, or
 * the top rendition of an edit's base generation, since the raw source has expired by then.
 */
export async function fetchGenerationSource(
  deps: SourceDeps,
  generation: VideoGeneration,
  dir: string
): Promise<Result<GenerationSource, SourceFailure>> {
  const { videoId, sourceKey, baseGeneration } = generation;
  if (sourceKey) return downloadUpload(deps, sourceKey, dir);
  if (baseGeneration === null) return missing(`Generation ${generation.generation} has no source`);

  const edit = await deps.repositories.videoGenerations.findEdit(videoId);
  if (isErr(edit)) return edit;
  const playback = await basePlayback(deps, videoId, baseGeneration);
  if (isErr(playback)) return playback;
  const ladder = z.array(LadderEntry).min(1).safeParse(playback.value?.ladder);
  if (!edit.value || !ladder.success) {
    return missing(`The base generation ${baseGeneration} is gone`);
  }
  const [top] = ladder.data.toSorted((a, b) => b.height - a.height);
  if (!top) return missing(`The base generation ${baseGeneration} has no rendition`);
  const fetched = await downloadRendition(deps, videoId, baseGeneration, top.name, dir);
  if (isErr(fetched)) return fetched;
  if (!fetched.value) return missing(`The base generation ${baseGeneration} lost its ${top.name}`);
  return ok({
    type: 'edit',
    path: path.join(dir, path.basename(renditionPlaylistKey(videoId, top.name, baseGeneration))),
    ladder: ladder.data,
    edits: { trim: edit.value.trim, blurs: edit.value.blurs },
  });
}
