export const MULTIPART_MIN_PART_SIZE = 8 * 1024 * 1024; // 8 MiB (AC 17)
export const MULTIPART_MAX_PART_SIZE = 64 * 1024 * 1024; // 64 MiB (AC 17)
export const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB (SDD §3.1)
export const MULTIPART_MAX_PARTS = 10000; // <= 10 000 parts (AC 17)
export const MULTIPART_URL_BATCH_SIZE = 100; // batches of <= 100 URLs (AC 17)
export const PRESIGNED_URL_TTL_SEC = 900; // 15 min (AC 17)

/**
 * Computes part size using clamp(ceil(size/1000), 8 MiB, 64 MiB) (SDD §3.1, AC 17).
 */
export function calculatePartSize(sizeBytes: number): number {
  const calculated = Math.ceil(sizeBytes / 1000);
  return Math.min(Math.max(calculated, MULTIPART_MIN_PART_SIZE), MULTIPART_MAX_PART_SIZE);
}

/**
 * Calculates total expected parts for a given file size and part size.
 */
export function calculateTotalParts(sizeBytes: number, partSize: number): number {
  return Math.ceil(sizeBytes / partSize);
}
