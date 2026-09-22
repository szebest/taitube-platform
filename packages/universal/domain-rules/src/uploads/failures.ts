import { ErrorCodes, type Failure } from '@vp/errors';

export type UploadNotOpen = Failure<
  typeof ErrorCodes.UPLOAD_NOT_OPEN,
  { uploadId: string; status: string }
>;

export type UploadExpired = Failure<
  typeof ErrorCodes.UPLOAD_EXPIRED,
  { uploadId: string; expiresAt: Date }
>;

export type PartManifestMismatch = Failure<
  typeof ErrorCodes.VALIDATION_FAILED,
  { uploadId: string; expected: number | null; received: number }
>;

export type UploadSizeMismatch = Failure<
  typeof ErrorCodes.UPLOAD_SIZE_MISMATCH,
  { videoId: string; declaredSizeBytes: number | null; actualSizeBytes: number }
>;

export type UploadOpenFailure = UploadNotOpen | UploadExpired;

export function uploadNotOpen(uploadId: string, status: string): UploadNotOpen {
  return {
    code: ErrorCodes.UPLOAD_NOT_OPEN,
    message: 'Upload is no longer open',
    uploadId,
    status,
  };
}

export function uploadExpired(uploadId: string, expiresAt: Date): UploadExpired {
  return { code: ErrorCodes.UPLOAD_EXPIRED, message: 'Upload has expired', uploadId, expiresAt };
}

export function partManifestMismatch(
  uploadId: string,
  expected: number | null,
  received: number
): PartManifestMismatch {
  return {
    code: ErrorCodes.VALIDATION_FAILED,
    message:
      expected === null
        ? 'Upload record is missing its multipart part count'
        : `Expected ${expected} parts but received ${received}`,
    uploadId,
    expected,
    received,
  };
}

export function uploadSizeMismatch(
  videoId: string,
  declaredSizeBytes: number | null,
  actualSizeBytes: number
): UploadSizeMismatch {
  return {
    code: ErrorCodes.UPLOAD_SIZE_MISMATCH,
    message: `Uploaded object size (${actualSizeBytes}) does not match declared size (${declaredSizeBytes})`,
    videoId,
    declaredSizeBytes,
    actualSizeBytes,
  };
}
