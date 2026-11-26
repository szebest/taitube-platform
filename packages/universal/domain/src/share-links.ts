import { MS_PER_DAY, MS_PER_HOUR } from '@kit/primitives';
import type { ViewDate } from './views';

export const SHARE_LINK_TARGET_TYPES = ['video'] as const;
export type ShareLinkTargetType = (typeof SHARE_LINK_TARGET_TYPES)[number];

export const SHARE_LINK_TOKEN_LENGTH = 22;
export const SHARE_LINK_LABEL_MAX_LENGTH = 60;
export const MAX_ACTIVE_SHARE_LINKS = 50;

export const SHARE_LINK_EXPIRIES = ['1h', '24h', '7d', '30d', 'never'] as const;
export type ShareLinkExpiry = (typeof SHARE_LINK_EXPIRIES)[number];

const EXPIRY_MS: Readonly<Record<ShareLinkExpiry, number | null>> = {
  '1h': MS_PER_HOUR,
  '24h': MS_PER_DAY,
  '7d': 7 * MS_PER_DAY,
  '30d': 30 * MS_PER_DAY,
  never: null,
};

export function shareLinkExpiresAt(expiry: ShareLinkExpiry, now: Date): Date | null {
  const lifetime = EXPIRY_MS[expiry];
  return lifetime === null ? null : new Date(now.getTime() + lifetime);
}

export interface ShareLink {
  readonly id: string;
  readonly targetType: ShareLinkTargetType;
  readonly targetId: string;
  readonly token: string;
  readonly label: string | null;
  readonly expiresAt: Date | null;
  readonly createdBy: string | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export type ShareLinkState = 'active' | 'expired' | 'revoked';

/** Revoked wins over expired: the creator's act is the reason the studio shows. */
export function shareLinkState(
  link: Pick<ShareLink, 'expiresAt' | 'revokedAt'>,
  now: Date
): ShareLinkState {
  if (link.revokedAt !== null) return 'revoked';
  if (link.expiresAt !== null && link.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export interface ShareLinkTotals {
  readonly opens: number;
  readonly views: number;
  readonly watchSeconds: number;
}

export const NO_SHARE_LINK_TOTALS: ShareLinkTotals = { opens: 0, views: 0, watchSeconds: 0 };

/** One link's numbers for one day, as a flush adds them to `share_link_stats`. */
export interface ShareLinkCount extends ShareLinkTotals {
  readonly linkId: string;
  readonly viewDate: ViewDate;
}

/** Adds the counts of the same link and day together, so a batch writes one row each. */
export function mergeShareLinkCounts(counts: readonly ShareLinkCount[]): ShareLinkCount[] {
  const merged = new Map<string, ShareLinkCount>();
  for (const count of counts) {
    const key = `${count.linkId}|${count.viewDate}`;
    const held = merged.get(key);
    merged.set(
      key,
      held
        ? {
            ...held,
            opens: held.opens + count.opens,
            views: held.views + count.views,
            watchSeconds: held.watchSeconds + count.watchSeconds,
          }
        : count
    );
  }
  return [...merged.values()];
}
