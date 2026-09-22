import { ErrorCodes, type InputFailure } from '@vp/errors';
import { type InvalidField, invalidField } from '../failures.js';

export type UploadTooLarge = InputFailure<
  typeof ErrorCodes.UPLOAD_TOO_LARGE,
  { sizeBytes: number; limitBytes: number }
>;

export type UnsupportedContentType = InputFailure<
  typeof ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
  { contentType: string; allowed: readonly string[] }
>;

export type InvalidTitle = InvalidField<{ maxLength: number }>;

export type StartUploadFailure = UploadTooLarge | UnsupportedContentType | InvalidTitle;

export function uploadTooLarge(sizeBytes: number, limitBytes: number): UploadTooLarge {
  return {
    code: ErrorCodes.UPLOAD_TOO_LARGE,
    message: `File exceeds the maximum upload size of ${limitBytes} bytes`,
    field: 'sizeBytes',
    sizeBytes,
    limitBytes,
  };
}

export function unsupportedContentType(
  contentType: string,
  allowed: readonly string[]
): UnsupportedContentType {
  return {
    code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
    message: `Content type ${contentType} is not supported. Allowed: ${allowed.join(', ')}`,
    field: 'contentType',
    contentType,
    allowed,
  };
}

export function invalidTitle(maxLength: number): InvalidTitle {
  return invalidField('title', `Title must be between 1 and ${maxLength} characters`, {
    maxLength,
  });
}
