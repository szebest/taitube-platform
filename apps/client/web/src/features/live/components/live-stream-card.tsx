import { Link } from '@tanstack/react-router';
import type { LiveStreamPublicView } from '@vp/api-contracts';
import { VideoCard, type VideoCardVariant } from '@vp/components';
import { useT } from '@vp/intl-react';

interface LiveStreamCardProps {
  stream: LiveStreamPublicView;
  variant: Extract<VideoCardVariant, 'grid' | 'shelf'>;
}

/** A broadcast live now: the card in its live state, linked to its live page and its channel. */
export function LiveStreamCard({ stream, variant }: LiveStreamCardProps) {
  const { tOr } = useT();
  const { channel } = stream;

  return (
    <VideoCard.Root variant={variant} state="live" videoId={stream.videoId ?? undefined}>
      <VideoCard.Thumb src={channel.avatarUrl ?? undefined} />
      <VideoCard.Byline
        name={channel.displayName}
        avatarSrc={channel.avatarUrl ?? undefined}
        asChild
      >
        <Link to="/channel/$channelId" params={{ channelId: channel.id }} />
      </VideoCard.Byline>
      <VideoCard.Title asChild>
        <Link to="/live/$streamId" params={{ streamId: stream.id }}>
          {stream.title || tOr('browse.untitled', {}, '')}
        </Link>
      </VideoCard.Title>
      <VideoCard.Meta>{tOr('live.watching', { count: stream.viewers }, '')}</VideoCard.Meta>
    </VideoCard.Root>
  );
}
