export const BAN_DURATIONS = ['1h', '24h', '7d', '30d', 'forever'] as const;

export type BanDuration = (typeof BAN_DURATIONS)[number];

const HOUR_MS = 3_600_000;

const LENGTH_MS: Record<Exclude<BanDuration, 'forever'>, number> = {
  '1h': HOUR_MS,
  '24h': 24 * HOUR_MS,
  '7d': 7 * 24 * HOUR_MS,
  '30d': 30 * 24 * HOUR_MS,
};

/** When a ban of this length that starts at `now` ends; `null` for one that lasts until it is lifted. */
export function banExpiry(duration: BanDuration, now: Date): string | null {
  return duration === 'forever'
    ? null
    : new Date(now.getTime() + LENGTH_MS[duration]).toISOString();
}
