export interface ChannelSubscription {
  id: string;
  subscriberId: string;
  channelId: string;
  createdAt: Date;
}

export interface SubscribedChannelItem {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  subscriberCount: number;
  subscribedAt: Date;
}

/**
 * Outcome of an idempotent subscribe/unsubscribe. `changed` is false when the
 * call was a no-op, which lets callers skip redundant cache writes.
 */
export interface SubscriptionChangeResult {
  subscriberCount: number;
  changed: boolean;
}
