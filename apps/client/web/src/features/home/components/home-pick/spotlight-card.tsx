import { Link } from '@tanstack/react-router';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { Button, Icon, useUiCopy } from '@vp/ui';

import { PickOfTheDay } from '#app/components/discovery/pick-of-the-day';
import { VideoCard } from '#app/components/video/video-card';
import type { Spotlight } from '#app/features/home/spotlight';
import { useAmbientSample } from '#app/hooks/use-ambient-sample';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useVideoActions } from '#app/hooks/use-video-actions';
import { PickWindow } from './pick-window';

export interface SpotlightCardProps {
  spotlight: Spotlight;
}

/** The home hero: the picked video, and for a scheduled pick its note and how long it stays. */
export function SpotlightCard({ spotlight }: SpotlightCardProps) {
  const { video } = spotlight;
  const { tOr } = useT();
  const copy = useUiCopy();
  const { save } = useVideoActions(video.id);
  const { clock, spoken } = useDurationText(video.durationMs);
  const poster = video.thumbnailUrl ?? video.posterUrl;
  const [glowColor] = useAmbientSample(poster);
  const { channel } = video;

  return (
    <PickOfTheDay.Root glowColor={glowColor}>
      <VideoCard.Root variant="spotlight" videoId={video.id}>
        <VideoCard.Thumb src={poster} duration={clock} spokenDuration={spoken} />
        <PickOfTheDay.Kicker />
        <VideoCard.Title asChild>
          <Link to="/watch/$videoId" params={{ videoId: video.id }}>
            {video.title ?? tOr('browse.untitled', {}, '')}
          </Link>
        </VideoCard.Title>
        {spotlight.source === 'scheduled' && (
          <>
            {spotlight.note !== null && <PickOfTheDay.Note>{spotlight.note}</PickOfTheDay.Note>}
            <PickWindow endsAt={spotlight.endsAt} />
          </>
        )}
        {channel && (
          <VideoCard.Byline
            name={channel.displayName}
            avatarSrc={channel.avatarUrl ?? undefined}
            asChild
          >
            <Link to="/channel/$channelId" params={{ channelId: channel.id }} />
          </VideoCard.Byline>
        )}
        <VideoCard.Meta>
          {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
          {' · '}
          <time dateTime={video.createdAt}>
            <Format value={publishedAt(video.createdAt).relative} />
          </time>
        </VideoCard.Meta>
        <PickOfTheDay.Actions>
          <Button asChild tone="accent" variant="solid">
            <Link to="/watch/$videoId" params={{ videoId: video.id }}>
              <Icon name="play" />
              {tOr('home.pickWatch', {}, '')}
            </Link>
          </Button>
          {save && (
            <Button variant="outline" onClick={save}>
              <Icon name="save" />
              {copy.save}
            </Button>
          )}
        </PickOfTheDay.Actions>
      </VideoCard.Root>
    </PickOfTheDay.Root>
  );
}
