import type { Channel as ChannelResource, OwnerChannel } from '@vp/api-contracts';
import {
  AVATAR_SIZES,
  type BANNER_TARGETS,
  BANNER_WIDTHS,
  type Channel,
  type ChannelLocalization,
  type ChannelStats,
  HANDLE_CHANGE_COOLDOWN_DAYS,
  type LiveStream,
  platformOfUrl,
} from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import type { CdnBase } from '@vp/env-schema';
import { channelImageVariantKey } from '@vp/storage';
import { cdnUrl } from './video-views';

export type ChannelView = ChannelResource;

export interface ChannelViewContext {
  cdn: CdnBase;
  /** The negotiated locale's row, when the channel wrote one: its description replaces the default. */
  localization?: ChannelLocalization | null;
}

/** Only a public broadcast puts the live dot on the channel: anyone may read this resource. */
function liveOf(stream: LiveStream | null): ChannelView['live'] {
  if (!(stream?.status === 'LIVE' && stream.visibility === 'public')) return null;
  const { id, videoId, startedAt } = stream;
  return videoId && startedAt
    ? { liveStreamId: id, videoId, startedAt: startedAt.toISOString() }
    : null;
}

function avatarOf({ id, avatarVersion }: Channel, cdn: CdnBase): ChannelView['avatar'] {
  if (avatarVersion === 0) return null;
  const url = (size: number) =>
    cdnUrl(cdn, channelImageVariantKey(id, 'avatar', String(size), avatarVersion));
  const [s48, s72, s128, s256] = AVATAR_SIZES;
  return { sizes: { '48': url(s48), '72': url(s72), '128': url(s128), '256': url(s256) } };
}

function bannerOf({ id, bannerVersion }: Channel, cdn: CdnBase): ChannelView['banner'] {
  if (bannerVersion === 0) return null;
  const [narrow, wide] = BANNER_WIDTHS;
  const target = (name: (typeof BANNER_TARGETS)[number]) => {
    const url = (width: number) =>
      cdnUrl(cdn, channelImageVariantKey(id, 'banner', `${name}-${width}`, bannerVersion));
    return { '1280': url(narrow), '2560': url(wide) };
  };
  return { desktop: target('desktop'), mobile: target('mobile'), tv: target('tv') };
}

/** Named field by field, so a column the public resource does not carry (the contact email) cannot leak by a spread. */
export function toChannelView(
  channel: Channel,
  stats: ChannelStats,
  stream: LiveStream | null,
  { cdn, localization }: ChannelViewContext
): ChannelView {
  return {
    id: channel.id,
    userId: channel.userId,
    handle: channel.handle,
    displayName: channel.displayName,
    avatarUrl: channel.avatarUrl,
    bannerUrl: channel.bannerUrl,
    avatar: avatarOf(channel, cdn),
    banner: bannerOf(channel, cdn),
    bannerLink: channel.bannerLink,
    country: channel.country,
    hasContact: channel.contactEmail !== null,
    brandColor: channel.brandColor,
    bio: localization?.description ?? channel.bio,
    links: channel.links.map((link) => ({ ...link, platform: platformOfUrl(link.url) })),
    subscriberCount: channel.subscriberCount,
    ...stats,
    live: liveOf(stream),
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

export function toOwnerExtras(
  channel: Channel,
  now: Date
): Pick<OwnerChannel, 'bannerCrops' | 'contactEmail' | 'handleChangeAvailableAt'> {
  const availableAt =
    channel.handleChangedAt &&
    new Date(channel.handleChangedAt.getTime() + HANDLE_CHANGE_COOLDOWN_DAYS * MS_PER_DAY);
  return {
    bannerCrops: channel.bannerCrops,
    contactEmail: channel.contactEmail,
    handleChangeAvailableAt: availableAt && availableAt > now ? availableAt.toISOString() : null,
  };
}
