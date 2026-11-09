import type { BannerCrops, ChannelBannerLink } from './channel-images';

export interface ChannelLink {
  label: string;
  url: string;
}

export interface ChannelStats {
  videoCount: number;
  totalViews: number;
}

export interface Channel {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  brandColor: string | null;
  bio: string | null;
  links: ChannelLink[];
  avatarVersion: number;
  bannerVersion: number;
  bannerCrops: BannerCrops | null;
  country: string | null;
  contactEmail: string | null;
  bannerLink: ChannelBannerLink | null;
  handleChangedAt: Date | null;
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
  brandColor?: string | null;
  bio?: string | null;
  subscriberCount?: number;
}

export interface UpdateChannelInput {
  handle?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  brandColor?: string | null;
  bio?: string | null;
  links?: ChannelLink[];
  country?: string | null;
  contactEmail?: string | null;
  bannerLink?: ChannelBannerLink | null;
  /** When the handle changes: the instant the old handle is retired and the cooldown starts. */
  handleChangedAt?: Date;
}

export type ChannelCard = Pick<Channel, 'id' | 'handle' | 'displayName' | 'avatarUrl'>;

export function toChannelCard({ id, handle, displayName, avatarUrl }: Channel): ChannelCard {
  return { id, handle, displayName, avatarUrl };
}

/** A handle a channel gave up, held for its owner until `HANDLE_RESERVATION_DAYS` pass. */
export interface ChannelHandleRetirement {
  handle: string;
  channelId: string;
  retiredAt: Date;
}

export interface ChannelPageSettings {
  trailerVideoId: string | null;
  returningVideoId: string | null;
}

export interface ChannelLocalization {
  locale: string;
  description: string | null;
  trailerVideoId: string | null;
}
