export type RestrictionKind = 'shadow' | 'ban';

export interface ChannelUserRestriction {
  channelId: string;
  userId: string;
  kind: RestrictionKind;
  reason: string | null;
  expiresAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
}

export type NewChannelUserRestriction = Omit<ChannelUserRestriction, 'createdAt'>;

/** An expired restriction counts as absent, so ending one needs no job. */
export function isRestrictionActive(restriction: { expiresAt: Date | null }, now: Date): boolean {
  return restriction.expiresAt === null || restriction.expiresAt > now;
}
