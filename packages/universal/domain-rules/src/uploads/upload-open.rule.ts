import type { Upload } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type UploadOpenFailure, uploadExpired, uploadNotOpen } from './failures.js';

export interface UploadOpenInput {
  readonly upload: Upload;
  /** Supplied, never read from a clock here, so the rule stays pure and testable. */
  readonly now: Date;
}

export function decideUploadOpen(input: UploadOpenInput): Result<Upload, UploadOpenFailure> {
  const { upload, now } = input;

  if (upload.status === 'ABORTED' || upload.status === 'COMPLETED') {
    return err(uploadNotOpen(upload.id, upload.status));
  }
  if (upload.expiresAt.getTime() <= now.getTime()) {
    return err(uploadExpired(upload.id, upload.expiresAt));
  }
  return ok(upload);
}
