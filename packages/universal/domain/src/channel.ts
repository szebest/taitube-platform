export interface Channel {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  subscriberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChannelInput {
  id?: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  subscriberCount?: number;
}

export interface UpdateChannelInput {
  handle?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
}

export type ChannelCard = Pick<Channel, 'id' | 'handle' | 'displayName' | 'avatarUrl'>;

export function toChannelCard({ id, handle, displayName, avatarUrl }: Channel): ChannelCard {
  return { id, handle, displayName, avatarUrl };
}
