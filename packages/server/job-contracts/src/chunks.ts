export const CHUNKED_TRANSCODE = { thresholdSeconds: 300, chunkSeconds: 30 } as const;

export function chunkCountFor(durationMs: number): number | undefined {
  if (durationMs <= CHUNKED_TRANSCODE.thresholdSeconds * 1000) return undefined;
  return Math.ceil(durationMs / (CHUNKED_TRANSCODE.chunkSeconds * 1000));
}
