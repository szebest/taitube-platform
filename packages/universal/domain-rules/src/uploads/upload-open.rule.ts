import { type Result, err, ok } from '@kit/result';
import type { Upload, UploadStatus } from '@vp/domain';
import { type UploadOpenFailure, uploadExpired, uploadNotOpen } from './failures';
import { UPLOAD_SESSION } from './upload-session.machine';

export interface UploadOpenInput {
  readonly upload: Upload;
  /** Supplied, never read from a clock here, so the rule stays pure and testable. */
  readonly now: Date;
}

export function decideUploadOpen(input: UploadOpenInput): Result<Upload, UploadOpenFailure> {
  const { upload, now } = input;

  if (UPLOAD_SESSION.final.includes(upload.status)) {
    return err(uploadNotOpen(upload.id, upload.status));
  }
  if (upload.expiresAt.getTime() <= now.getTime()) {
    return err(uploadExpired(upload.id, upload.expiresAt));
  }
  return ok(upload);
}

/** The states an upload may move to `status` from: the compare-and-set a repository writes it under. */
export function uploadSourcesInto(status: UploadStatus): readonly UploadStatus[] {
  return UPLOAD_SESSION.eventNames
    .filter((event) => UPLOAD_SESSION.target(event) === status)
    .flatMap((event) => UPLOAD_SESSION.sources(event));
}
