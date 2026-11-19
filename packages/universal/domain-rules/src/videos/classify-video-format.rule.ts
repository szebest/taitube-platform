import { MS_PER_MINUTE } from '@kit/primitives';
import type { VideoFormat } from '@vp/domain';

const SHORT_MAX_DURATION_MS = 3 * MS_PER_MINUTE;

export interface VideoShape {
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

export function classifyVideoFormat({ width, height, durationMs }: VideoShape): VideoFormat {
  if (width == null || height == null || durationMs == null) return 'standard';
  return height > width && durationMs <= SHORT_MAX_DURATION_MS ? 'short' : 'standard';
}
