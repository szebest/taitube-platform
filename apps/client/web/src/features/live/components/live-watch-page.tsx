import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ClientOnly, Link, useParams } from '@tanstack/react-router';
import type { LiveStreamPublicView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useApi, useLiveVideoEvents } from '@vp/queries';
import { Badge, Button } from '@vp/ui';
import { Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { type LiveChatLayout, LiveChatSkeleton } from '#app/components/live/live-chat';
import { LiveLayout } from '#app/components/live/live-layout';
import { Stage } from '#app/components/watch/stage';
import {
  type PlaybackQuality,
  PlayerChannelProvider,
  usePlayerFullscreen,
} from '#app/features/player';
import { LazyTaitubePlayer } from '#app/features/player/taitube-player.lazy';
import { liveKeys, liveStreamQueryOptions } from '../api/live-queries';
import { useChatDock } from '../hooks/use-chat-dock';
import { LiveChatReplay } from './live-chat-replay';
import { LiveStreamChat } from './live-stream-chat';

interface StreamChatProps {
  stream: LiveStreamPublicView;
  layout: LiveChatLayout;
  replayShown: boolean;
  menuContainer: HTMLElement;
}

function StreamChat({ stream, layout, replayShown, menuContainer }: StreamChatProps) {
  if (stream.status === 'LIVE') {
    return <LiveStreamChat stream={stream} layout={layout} menuContainer={menuContainer} />;
  }
  if (!(replayShown && stream.playbackUrl)) {
    return null;
  }

  return <LiveChatReplay liveStreamId={stream.id} layout={layout} menuContainer={menuContainer} />;
}

function LiveWatch({ liveStreamId }: { liveStreamId: string }) {
  const [vertical, setVertical] = useState(false);
  const [replayShown, setReplayShown] = useState(true);

  const api = useApi();
  const queryClient = useQueryClient();
  const { tOr } = useT();
  const { data: stream } = useSuspenseQuery(liveStreamQueryOptions(api, liveStreamId));
  const live = stream.status === 'LIVE';
  const heard = useLiveVideoEvents(live ? stream.videoId : null);
  const fullscreen = usePlayerFullscreen();

  const chatLayout = fullscreen || vertical ? 'overlay' : 'docked';
  const { host: chatHost, dockedRef, overlayRef } = useChatDock(chatLayout);
  const viewers = heard.viewers ?? stream.viewers;
  const endedWhileOpen = heard.status === 'ENDED';

  useEffect(() => {
    if (endedWhileOpen) {
      void queryClient.invalidateQueries({ queryKey: liveKeys.detail(liveStreamId) });
    }
  }, [endedWhileOpen, queryClient, liveStreamId]);

  const handleQualityChange = ({ width, height }: PlaybackQuality) => {
    if (width !== undefined && height !== undefined) {
      setVertical(height > width);
    }
  };

  return (
    <LiveLayout.Root chat={chatLayout}>
      <LiveLayout.Stage>
        <Stage.Root
          variant={vertical ? 'vertical' : 'standard'}
          className={vertical ? 'mx-auto h-[min(100dvh-6rem,56rem)] w-auto' : undefined}
        >
          {stream.playbackUrl && stream.videoId ? (
            <ClientOnly>
              <Suspense fallback={<Stage.Status kind="loading" />}>
                <Stage.Player>
                  <LazyTaitubePlayer
                    key={stream.playbackUrl}
                    videoId={stream.videoId}
                    playbackUrl={stream.playbackUrl}
                    title={stream.title}
                    live={live}
                    layout={vertical ? 'fill' : 'landscape'}
                    control={live ? { paused: false, muted: false } : undefined}
                    onQualityChange={handleQualityChange}
                    overlay={
                      chatLayout === 'overlay' && (
                        <div
                          ref={overlayRef}
                          data-interactive
                          className="absolute inset-bs-0 inset-be-[4.5rem] end-0 w-full max-w-[22.5rem]"
                        />
                      )
                    }
                  />
                </Stage.Player>
              </Suspense>
            </ClientOnly>
          ) : (
            <Stage.Status kind="unavailable">{tOr('live.endedProcessing', {}, '')}</Stage.Status>
          )}
        </Stage.Root>
      </LiveLayout.Stage>
      <LiveLayout.Chat ref={dockedRef}>
        <ClientOnly fallback={<LiveChatSkeleton />}>{null}</ClientOnly>
      </LiveLayout.Chat>
      {chatHost &&
        createPortal(
          <StreamChat
            stream={stream}
            layout={chatLayout}
            replayShown={replayShown}
            menuContainer={chatHost}
          />,
          chatHost
        )}
      <LiveLayout.Details>
        <h1 className="m-0 text-title-lg large:text-headline">
          {stream.title || tOr('browse.untitled', {}, '')}
        </h1>
        <div className="flex flex-wrap items-center gap-stack text-body-sm text-fg-muted">
          <Link
            to="/channel/$channelId"
            params={{ channelId: stream.channel.id }}
            className="text-label text-fg"
          >
            {stream.channel.displayName}
          </Link>
          {live ? (
            <>
              <Badge variant="solid" tone="live">
                {tOr('live.title', {}, '')}
              </Badge>
              <span aria-live="polite">{tOr('live.watching', { count: viewers }, '')}</span>
            </>
          ) : (
            <span>{tOr('live.endedTitle', {}, '')}</span>
          )}
          {!live && stream.playbackUrl && (
            <Button
              size="sm"
              variant="soft"
              aria-pressed={replayShown}
              onClick={() => setReplayShown(!replayShown)}
            >
              {replayShown ? tOr('live.hideReplay', {}, '') : tOr('live.showReplay', {}, '')}
            </Button>
          )}
        </div>
        {stream.description && (
          <p className="m-0 max-w-prose text-body whitespace-pre-line">{stream.description}</p>
        )}
      </LiveLayout.Details>
    </LiveLayout.Root>
  );
}

/** `/live/$streamId`: the broadcast in the player, its chat docked beside it or over it, and its details. */
export function LiveWatchPage() {
  const { streamId } = useParams({ from: '/live/$streamId' });

  return (
    <PlayerChannelProvider>
      <LiveWatch key={streamId} liveStreamId={streamId} />
    </PlayerChannelProvider>
  );
}
