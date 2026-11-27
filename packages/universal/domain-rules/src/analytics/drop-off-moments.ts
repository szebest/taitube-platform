import { type RetentionPoint, RETENTION_FULL_PERCENT } from '@vp/domain';

const DROP_OFF_COUNT = 3;

export interface DropOffMoment {
  readonly percent: number;
  readonly positionSeconds: number;
  readonly lostShare: number;
}

/**
 * The biggest drops of a filled retention curve, largest first. A drop is the viewers lost between two
 * consecutive points, reported at the start of its bucket and as a share of the viewers who began.
 * The first step is the bounce and belongs to the average, so it is never listed.
 */
export function dropOffMoments(
  curve: readonly RetentionPoint[],
  durationSeconds: number
): DropOffMoment[] {
  const [start] = curve;
  if (!start || start.viewers <= 0 || durationSeconds <= 0) return [];

  const drops: DropOffMoment[] = [];
  for (let step = 1; step < curve.length - 1; step += 1) {
    const from = curve[step];
    const to = curve[step + 1];
    if (!from || !to || from.viewers <= to.viewers) continue;
    drops.push({
      percent: from.percent,
      positionSeconds: Math.floor((from.percent / RETENTION_FULL_PERCENT) * durationSeconds),
      lostShare: (from.viewers - to.viewers) / start.viewers,
    });
  }

  return drops
    .sort((a, b) => b.lostShare - a.lostShare || a.percent - b.percent)
    .slice(0, DROP_OFF_COUNT);
}
