import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StorageClient } from '@vp/core/ports';
import { ErrorCodes, type MediaFailure, mediaFailure, type StorageUnavailable } from '@vp/errors';
import { err, fromPromise, isErr, ok, type Result } from '@vp/result';
import { chunkKey } from '@vp/storage';
import { transcodeFailure } from './transcode-failure';

export interface ConcatInputParams {
  storage: StorageClient;
  rawBucket: string;
  tmpDir: string;
  videoId: string;
  generation: number;
  rendition: string;
  chunkCount: number;
}

/** Downloads every chunk of a rendition and writes the list file the concat demuxer reads. */
export async function writeConcatList(
  params: ConcatInputParams
): Promise<Result<string, MediaFailure | StorageUnavailable>> {
  const { storage, rawBucket, tmpDir, videoId, generation, rendition, chunkCount } = params;
  const files: string[] = [];

  for (let index = 0; index < chunkCount; index += 1) {
    const key = chunkKey(videoId, generation, rendition, index);
    const target = path.join(tmpDir, `chunk_${index}.mp4`);
    const downloaded = await storage.downloadObject(rawBucket, key, target);
    if (isErr(downloaded)) return downloaded;
    if (!downloaded.value) {
      return err(
        mediaFailure(
          `transcode-${rendition}`,
          ErrorCodes.SOURCE_MISSING,
          `Chunk ${index} of ${chunkCount} is missing at ${key}`
        )
      );
    }
    files.push(target);
  }

  const listPath = path.join(tmpDir, 'chunks.txt');
  const written = await fromPromise(
    () => fs.writeFile(listPath, files.map((file) => `file '${file}'`).join('\n')),
    (cause) => transcodeFailure(rendition, cause)
  );
  return isErr(written) ? written : ok(listPath);
}
