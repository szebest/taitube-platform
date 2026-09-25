import type { PercentValue } from '../formatters/percent';

export function uploadProgress(uploadedBytes: number, totalBytes: number): PercentValue {
  const points = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
  return { type: 'percent', value: points, options: { maximumFractionDigits: 0 } };
}
