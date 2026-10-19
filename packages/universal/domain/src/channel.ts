export interface ChannelLink {
  label: string;
  url: string;
}

/** What a channel page shows for the channel as a whole, kept by the store, never counted per read. */
export interface ChannelStats {
  videoCount: number;
  totalViews: number;
}

export interface Channel extends ChannelStats {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  links: ChannelLink[];
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
  links?: ChannelLink[];
}

export type ChannelCard = Pick<Channel, 'id' | 'handle' | 'displayName' | 'avatarUrl'>;

export function toChannelCard({ id, handle, displayName, avatarUrl }: Channel): ChannelCard {
  return { id, handle, displayName, avatarUrl };
}
