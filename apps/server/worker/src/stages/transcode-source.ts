import * as path from 'node:path';
import type { StorageClient } from '@vp/core/ports';
import { ErrorCodes, type MediaFailure, type StorageUnavailable, mediaFailure } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { type Result, err, isErr, ok } from '@vp/result';

export interface TranscodeSourceParams {
  storage: StorageClient;
  rawBucket: string;
  sourceKey: string;
  tmpDir: string;
  rendition: string;
  /** Presigned streaming input hands FFmpeg a URL and never touches the local disk */
  streaming: boolean;
  log: Logger;
}

export type TranscodeSourceFailure = MediaFailure | StorageUnavailable;

/** What FFmpeg reads from: a presigned URL, or a local copy of the source object. */
export async function resolveTranscodeSource(
  params: TranscodeSourceParams
): Promise<Result<string, TranscodeSourceFailure>> {
  const { storage, rawBucket, sourceKey, tmpDir, rendition, streaming, log } = params;
  const stage = `transcode-${rendition}`;

  if (streaming) {
    log.info({ sourceKey }, 'using presigned URL streaming input mode for transcode');
    return storage.createPresignedGetUrl({
      bucket: rawBucket,
      key: sourceKey,
      expiresInSeconds: 7200,
    });
  }

  const head = await storage.headObject(rawBucket, sourceKey);
  if (isErr(head)) return head;
  if (!head.value) {
    log.error({ sourceKey }, 'source object not found in storage');
    return err(
      mediaFailure(
        stage,
        ErrorCodes.SOURCE_MISSING,
        `Source object not found in storage at ${sourceKey}`
      )
    );
  }

  const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
  const downloaded = await storage.downloadObject(rawBucket, sourceKey, localSourcePath);
  if (isErr(downloaded)) return downloaded;

  if (!downloaded.value) {
    log.error({ sourceKey }, 'failed to download source object');
    return err(
      mediaFailure(
        stage,
        ErrorCodes.SOURCE_MISSING,
        `Failed to download source object from ${sourceKey}`
      )
    );
  }

  return ok(localSourcePath);
}
