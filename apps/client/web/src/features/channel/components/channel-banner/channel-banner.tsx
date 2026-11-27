import type { Channel } from '@vp/api-contracts';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { bannerSources } from '#app/features/channel/utils/banner-sources';
import { httpsUrl } from '#app/features/channel/utils/https-url';

export interface ChannelBannerProps {
  channel: Pick<Channel, 'banner' | 'bannerUrl' | 'bannerLink'>;
}

const FULL_WIDTH = '100vw';

/** The channel's banner: its three targets through one `picture`, else the address set earlier, with the banner link in the safe area. */
export function ChannelBanner({ channel: { banner, bannerUrl, bannerLink } }: ChannelBannerProps) {
  const href = bannerLink ? httpsUrl(bannerLink.url) : undefined;
  const link = bannerLink && href && (
    <ChannelHeader.BannerLink href={href}>{bannerLink.label}</ChannelHeader.BannerLink>
  );

  if (!banner) {
    return <ChannelHeader.Banner src={bannerUrl ?? undefined} link={link || undefined} />;
  }

  const { sources, image } = bannerSources(banner);
  return (
    <ChannelHeader.Banner asChild link={link || undefined}>
      <picture>
        {sources.map(({ media, srcSet }) => (
          <source key={media} media={media} srcSet={srcSet} sizes={FULL_WIDTH} />
        ))}
        <img src={image.src} srcSet={image.srcSet} sizes={FULL_WIDTH} alt="" />
      </picture>
    </ChannelHeader.Banner>
  );
}
