import { type Result, err, ok } from '@vp/result';
import { type UploadTooLarge, uploadTooLarge } from './failures';

export function validateUploadSize(
  sizeBytes: number,
  limitBytes: number
): Result<number, UploadTooLarge> {
  return sizeBytes > limitBytes ? err(uploadTooLarge(sizeBytes, limitBytes)) : ok(sizeBytes);
}
