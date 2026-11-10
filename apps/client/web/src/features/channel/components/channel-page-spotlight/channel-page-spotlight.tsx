import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';
import { VideoCard } from '@vp/components';
import { publishedAt } from '@vp/intl';
import { Format, useFormat, useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { Button, Icon } from '@vp/ui';
import {
  ChannelSpotlight,
  type ChannelSpotlightSource,
} from '#app/components/channel/channel-spotlight';
import { useDurationText } from '#app/hooks/use-duration-text';
import { channelSpotlightQueryOptions } from '#app/lib/query-keys/channel-keys';

interface SpotlightVideoProps {
  source: ChannelSpotlightSource;
  video: VideoSummary;
}

function SpotlightVideo({ source, video }: SpotlightVideoProps) {
  const { tOr } = useT();
  const { clock, spoken } = useDurationText(video.durationMs);
  const poster = video.thumbnailUrl ?? video.posterUrl;
  const watch = { to: '/watch/$videoId', params: { videoId: video.id } } as const;

  return (
    <ChannelSpotlight.Root source={source}>
      <VideoCard.Root variant="spotlight" videoId={video.id}>
        <VideoCard.Thumb src={poster} duration={clock} spokenDuration={spoken} />
        <ChannelSpotlight.Kicker>
          {tOr(
            source === 'returning' ? 'channels.spotlightReturning' : 'channels.spotlightTrailer',
            {},
            ''
          )}
        </ChannelSpotlight.Kicker>
        <VideoCard.Title asChild>
          <Link {...watch}>{video.title ?? tOr('browse.untitled', {}, '')}</Link>
        </VideoCard.Title>
        <VideoCard.Meta>
          {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
          {' · '}
          <time dateTime={video.createdAt}>
            <Format value={publishedAt(video.createdAt).relative} />
          </time>
        </VideoCard.Meta>
        <ChannelSpotlight.Actions>
          <Button asChild tone="accent" variant="solid">
            <Link {...watch}>
              <Icon name="play" />
              {tOr('channels.spotlightWatch', {}, '')}
            </Link>
          </Button>
        </ChannelSpotlight.Actions>
      </VideoCard.Root>
    </ChannelSpotlight.Root>
  );
}

/**
 * The trailer, or for a subscriber the video kept for them, above the channel's Home. Read apart from the
 * channel and keyed by the viewer and the locale; it renders nothing when the channel has none to show.
 */
export function ChannelPageSpotlight({ channelId }: { channelId: string }) {
  const { context } = useFormat();
  const account = useAccount();
  const { data } = useQuery(
    channelSpotlightQueryOptions(useApi(), channelId, context.locale, account?.id ?? null)
  );

  if (data === undefined || data.source === null || data.video === null) {
    return null;
  }

  return <SpotlightVideo source={data.source} video={data.video} />;
}
