import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getHeaderMapping } from '@kit/object-storage';
import { type Result, fromPromise, isErr, ok } from '@kit/result';
import type { StorageClient } from '@vp/core/ports';
import { ErrorCodes, type MediaFailure, type StorageUnavailable, mediaFailure } from '@vp/errors';

const PLAYLIST = 'index.m3u8';

/** Uploads a rendered rendition directory under `prefix`, its playlist last, so a playlist never names a missing segment. */
export async function uploadRendition(
  storage: StorageClient,
  bucket: string,
  dir: string,
  prefix: string
): Promise<Result<void, StorageUnavailable | MediaFailure>> {
  const listed = await fromPromise(
    () => fs.readdir(dir),
    () =>
      mediaFailure('apply-edits', ErrorCodes.SEGMENT_VERIFY_FAILED, `Nothing rendered in ${dir}`)
  );
  if (isErr(listed)) return listed;
  const files = [...listed.value.filter((name) => name !== PLAYLIST).toSorted(), PLAYLIST];
  for (const name of files) {
    const body = await fromPromise(
      () => fs.readFile(path.join(dir, name)),
      () =>
        mediaFailure('apply-edits', ErrorCodes.SEGMENT_VERIFY_FAILED, `${name} was not rendered`)
    );
    if (isErr(body)) return body;
    const headers = getHeaderMapping(name);
    const uploaded = await storage.uploadObject({
      bucket,
      key: `${prefix}${name}`,
      body: body.value,
      contentType: headers.contentType,
      cacheControl: headers.cacheControl,
    });
    if (isErr(uploaded)) return uploaded;
  }
  return ok();
}
