import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';
import { type Result, err, fromPromise, ok } from '@vp/result';

const STAGE = 'screen';

/** Hashes the file as a stream, so a 90 MB model is never held in memory twice. */
async function sha256Of(file: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

/** A model that is missing or is not the pinned file will never become the right one by retrying. */
export async function verifyModelFile(
  file: string,
  expectedSha256: string
): Promise<Result<void, MediaFailure>> {
  const actual = await fromPromise(
    () => sha256Of(file),
    (cause) =>
      mediaFailure(
        STAGE,
        ErrorCodes.SCREEN_MODEL_INVALID,
        `The screening model ${file} cannot be read: ${(cause as Error).message}`
      )
  );
  if (!actual.ok) return actual;
  if (actual.value !== expectedSha256) {
    return err(
      mediaFailure(
        STAGE,
        ErrorCodes.SCREEN_MODEL_INVALID,
        `The screening model ${file} has sha256 ${actual.value}, the lock file pins ${expectedSha256}`
      )
    );
  }
  return ok();
}
