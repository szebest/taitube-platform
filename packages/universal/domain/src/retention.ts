export const RETENTION_STEP_PERCENT = 5;
const FULL_PERCENT = 100;

export interface RetentionCount {
  readonly videoId: string;
  readonly percent: number;
  readonly viewers: number;
}

export interface RetentionPoint {
  readonly percent: number;
  readonly viewers: number;
}

export function retentionPercentOf(currentTime: number, duration: number): number {
  const reached = Math.min(currentTime / duration, 1) * FULL_PERCENT;
  return Math.floor(reached / RETENTION_STEP_PERCENT) * RETENTION_STEP_PERCENT;
}

export function fillRetentionCurve(points: readonly RetentionPoint[]): RetentionPoint[] {
  const viewers = new Map(points.map((point) => [point.percent, point.viewers]));
  return Array.from({ length: FULL_PERCENT / RETENTION_STEP_PERCENT + 1 }, (_, step) => {
    const percent = step * RETENTION_STEP_PERCENT;
    return { percent, viewers: viewers.get(percent) ?? 0 };
  });
}
