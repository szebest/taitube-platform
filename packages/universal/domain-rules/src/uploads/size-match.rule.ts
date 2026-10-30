import type { Video } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type UploadSizeMismatch, uploadSizeMismatch } from './failures';

export interface SizeMatchInput {
  readonly video: Video;
  readonly actualSizeBytes: number;
}

/**
 * A declared size of null means the client never committed to one, so there is nothing to
 * disagree with and the object is accepted.
 */
export function decideSizeMatch(input: SizeMatchInput): Result<number, UploadSizeMismatch> {
  const declared = input.video.sourceSizeBytes;

  if (declared && declared !== input.actualSizeBytes) {
    return err(uploadSizeMismatch(input.video.id, declared, input.actualSizeBytes));
  }
  return ok(input.actualSizeBytes);
}
