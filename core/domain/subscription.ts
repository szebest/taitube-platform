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

export interface SubscribeResult {
  subscribed: boolean;
  subscriberCount: number;
  isNew: boolean;
}

export interface UnsubscribeResult {
  subscribed: boolean;
  subscriberCount: number;
  wasSubscribed: boolean;
}
