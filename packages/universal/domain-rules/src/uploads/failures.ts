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

export type UploadNotFound = Failure<typeof ErrorCodes.VIDEO_NOT_FOUND, { uploadId: string }>;

export type SourceMissing = Failure<
  typeof ErrorCodes.SOURCE_MISSING,
  { videoId: string; sourceKey: string }
>;

/** A part URL or a part manifest only means something for a multipart session. */
export type NotMultipart = Failure<typeof ErrorCodes.VALIDATION_FAILED, { uploadId: string }>;

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

export function uploadNotFound(uploadId: string): UploadNotFound {
  return { code: ErrorCodes.VIDEO_NOT_FOUND, message: 'Upload not found', uploadId };
}

export function sourceMissing(videoId: string, sourceKey: string): SourceMissing {
  return {
    code: ErrorCodes.SOURCE_MISSING,
    message: `Source file not found at ${sourceKey}`,
    videoId,
    sourceKey,
  };
}

export function notMultipart(uploadId: string): NotMultipart {
  return {
    code: ErrorCodes.VALIDATION_FAILED,
    message: 'This upload is a single PUT, not a multipart session',
    uploadId,
  };
}
