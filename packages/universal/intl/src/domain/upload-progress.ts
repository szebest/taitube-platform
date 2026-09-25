import type { PercentValue } from '../formatters/percent';

/** In percentage points, as the transfer reports it: `42.6` reads `43%`. */
export function uploadProgress(percentagePoints: number): PercentValue {
  return { type: 'percent', value: percentagePoints, options: { maximumFractionDigits: 0 } };
}
