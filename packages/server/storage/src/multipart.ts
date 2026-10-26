export const MULTIPART_URL_BATCH_SIZE = 100;

/** ListObjectsV2 pages and DeleteObjects batches both stop at 1000 keys. */
export const S3_MAX_KEYS_PER_REQUEST = 1000;

export interface PartSizeBounds {
  minBytes: number;
  maxBytes: number;
}

const MIB = 1024 * 1024;

const S3_MIN_PART_SIZE = 5 * MIB;
const S3_MAX_PARTS = 10_000;
const TARGET_PARTS = 128;

const ceilToMib = (bytes: number): number => Math.ceil(bytes / MIB) * MIB;

/** About 128 parts, in whole MiB, inside the bounds, and never more than S3's 10 000 parts (SDD §3.1). */
export function calculatePartSize(
  sizeBytes: number,
  { minBytes, maxBytes }: PartSizeBounds
): number {
  const target = ceilToMib(sizeBytes / TARGET_PARTS);
  const bounded = Math.min(Math.max(target, minBytes, S3_MIN_PART_SIZE), maxBytes);
  return Math.max(bounded, ceilToMib(sizeBytes / S3_MAX_PARTS));
}

export function calculateTotalParts(sizeBytes: number, partSize: number): number {
  return Math.ceil(sizeBytes / partSize);
}
