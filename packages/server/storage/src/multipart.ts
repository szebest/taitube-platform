/** S3 refuses an upload of more than 10 000 parts. */
export const MULTIPART_MAX_PARTS = 10000;
export const MULTIPART_URL_BATCH_SIZE = 100;

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
