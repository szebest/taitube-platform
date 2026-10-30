import { err, ok, type Result } from '@vp/result';
import { type ViewTooShort, viewTooShort } from './failures';

export interface ViewTelemetry {
  readonly sessionId: string;
  readonly watchSeconds: number;
  readonly videoDuration: number;
}

export interface ViewLimits {
  readonly minWatchSeconds: number;
}

export interface QualifiedView {
  readonly sessionId: string;
  readonly watchSeconds: number;
}

/** A video shorter than the minimum qualifies once watched to the end. */
export function requiredWatchSeconds(videoDuration: number, limits: ViewLimits): number {
  return Math.min(limits.minWatchSeconds, videoDuration);
}

/**
 * The anti-fraud gate a playback beacon passes before it counts. A video shorter than the minimum
 * qualifies once watched to the end, and watch time past the end is clamped, so a replayed beacon
 * cannot inflate retention.
 */
export function qualifyView(
  telemetry: ViewTelemetry,
  limits: ViewLimits
): Result<QualifiedView, ViewTooShort> {
  const requiredSeconds = requiredWatchSeconds(telemetry.videoDuration, limits);
  if (telemetry.watchSeconds < requiredSeconds) {
    return err(viewTooShort(telemetry.watchSeconds, requiredSeconds));
  }
  return ok({
    sessionId: telemetry.sessionId,
    watchSeconds: Math.min(telemetry.watchSeconds, telemetry.videoDuration),
  });
}
