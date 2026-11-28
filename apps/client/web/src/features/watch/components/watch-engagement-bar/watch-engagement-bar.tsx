import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { BrandScope, useUiCopy } from '@kit/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { SectionBoundary, useApi } from '@vp/queries';
import type { ReactNode } from 'react';
import { SubscribeAction } from '#app/components/channel/subscribe-action';
import { WatchTogether } from '#app/components/party/watch-together';
import { usePlayerSeek } from '#app/components/player/taitube-player';
import { EngagementBar } from '#app/components/watch/engagement-bar';
import { ShareDialog } from '#app/components/watch/share-dialog';
import { toSummary } from '#app/features/watch/utils/to-summary';
import { useReaction } from '#app/hooks/use-reaction';
import { useVideoActions } from '#app/hooks/use-video-actions';
import { useT } from '#app/lib/messages';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import { StartThreadAction } from '../start-thread-action/start-thread-action';

function ChannelSection({ channelId, videoId }: { channelId: string; videoId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const { data: channel } = useSuspenseQuery(channelQueryOptions(api, channelId));

  return (
    <BrandScope color={channel.brandColor}>
      <EngagementBar.Channel
        name={channel.displayName}
        avatarSrc={channel.avatarUrl ?? undefined}
        subscribers={tOr('channels.subscribers', { count: channel.subscriberCount }, '')}
        asChild
      >
        <Link to="/channel/$channelId" params={{ channelId: channel.id }} />
      </EngagementBar.Channel>
      <SubscribeAction channelId={channel.id} fromVideoId={videoId} />
    </BrandScope>
  );
}

function ReactionSection({ video }: { video: Video }) {
  const { format } = useFormat();
  const { reaction, change } = useReaction(video.id);

  return (
    <EngagementBar.Reaction
      value={reaction}
      likes={unwrapOr(format({ type: 'count', value: video.likesCount }), '')}
      onChange={change}
    />
  );
}

function SaveSection({ video }: { video: Video }) {
  const { save } = useVideoActions(toSummary(video));
  const { save: label } = useUiCopy();

  if (!save) return null;
  return (
    <EngagementBar.Action icon="save" onClick={save}>
      {label}
    </EngagementBar.Action>
  );
}

function QueueSection({ video }: { video: Video }) {
  const { enqueue, playNext } = useVideoActions(toSummary(video));
  const { addToQueue, playNext: playNextLabel } = useUiCopy();

  return (
    <>
      {enqueue && (
        <EngagementBar.Action icon="queue-add" onClick={enqueue}>
          {addToQueue}
        </EngagementBar.Action>
      )}
      {playNext && (
        <EngagementBar.Action icon="play" onClick={playNext}>
          {playNextLabel}
        </EngagementBar.Action>
      )}
    </>
  );
}

const MS_PER_SECOND = 1000;

function WatchTogetherSection({ video }: { video: Video }) {
  const { currentTime } = usePlayerSeek();
  const { tOr } = useT();

  return (
    <WatchTogether.Root
      source={() => ({
        kind: 'video',
        videoId: video.id,
        startMs: Math.floor(currentTime() * MS_PER_SECOND) || undefined,
      })}
    >
      <WatchTogether.Trigger>
        <EngagementBar.Action icon="party">
          {tOr('party.watchTogether', {}, '')}
        </EngagementBar.Action>
      </WatchTogether.Trigger>
    </WatchTogether.Root>
  );
}

export interface WatchEngagementBarProps {
  video: Video;
  /** More actions after Save, from the features the route composes in. */
  renderActions?: (video: Video) => ReactNode;
}

/** The channel, Subscribe, the reactions, Share, Save, Add to queue, Play next and Start a thread under a video's title. */
export function WatchEngagementBar({ video, renderActions }: WatchEngagementBarProps) {
  const { tOr } = useT();

  return (
    <EngagementBar.Root>
      {video.channel && (
        <SectionBoundary
          message={tOr('watch.channelFailed', {}, '')}
          resetKey={video.channel.id}
          layout="bar"
        >
          <ChannelSection channelId={video.channel.id} videoId={video.id} />
        </SectionBoundary>
      )}
      <EngagementBar.Actions>
        <ReactionSection video={video} />
        <ShareDialog video={video} />
        <WatchTogetherSection video={video} />
        <SaveSection video={video} />
        <QueueSection video={video} />
        <StartThreadAction videoId={video.id} variant="pill" />
        {renderActions?.(video)}
      </EngagementBar.Actions>
    </EngagementBar.Root>
  );
}
