export const MULTIPART_URL_BATCH_SIZE = 100;

/** ListObjectsV2 pages and DeleteObjects batches both stop at 1000 keys. */
export const S3_MAX_KEYS_PER_REQUEST = 1000;

export interface PartSizeBounds {
  minBytes: number;
  maxBytes: number;
}

/** A thousandth of the file, clamped to the bounds (SDD §3.1). */
export function calculatePartSize(
  sizeBytes: number,
  { minBytes, maxBytes }: PartSizeBounds
): number {
  return Math.min(Math.max(Math.ceil(sizeBytes / 1000), minBytes), maxBytes);
}

export function calculateTotalParts(sizeBytes: number, partSize: number): number {
  return Math.ceil(sizeBytes / partSize);
}
