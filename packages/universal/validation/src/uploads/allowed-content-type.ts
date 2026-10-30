import { type Result, err, ok } from '@vp/result';
import { type UnsupportedContentType, unsupportedContentType } from './failures';

/**
 * The container formats the pipeline can probe and transcode. It lives here rather than in a
 * route so that the browser renders its dropzone `accept` map from the same list the backend
 * enforces, instead of hardcoding a narrower one.
 */
export const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
] as const;

export function validateContentType(
  contentType: string,
  allowed: readonly string[]
): Result<string, UnsupportedContentType> {
  return allowed.includes(contentType)
    ? ok(contentType)
    : err(unsupportedContentType(contentType, allowed));
}
