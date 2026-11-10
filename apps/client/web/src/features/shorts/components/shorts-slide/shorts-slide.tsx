import { useQuery } from '@tanstack/react-query';
import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { captionsQueryOptions, useApi } from '@vp/queries';
import { type ReactNode, useState } from 'react';
import { SubscribeAction } from '#app/components/channel/subscribe-action';
import { PlayerChannelProvider } from '#app/components/player/taitube-player';
import { ShortsPlayerFrame } from '#app/components/shorts/shorts-player-frame';
import type { ShortsActionsLayout } from '#app/components/shorts/shorts-player-frame/types';
import type { useShortsPlayback } from '#app/features/shorts/hooks/use-shorts-playback';
import { ShortsFeedActions } from '../shorts-feed-actions/shorts-feed-actions';
import { ShortsFeedControls } from '../shorts-feed-controls/shorts-feed-controls';
import { ShortsFeedPlayer } from '../shorts-feed-player/shorts-feed-player';
import { ShortsFeedProgress } from '../shorts-feed-progress/shorts-feed-progress';

export interface ShortsSlideProps {
  short: VideoSummary;
  /** How far from the Short on screen: 0 is the one on screen, 1 and -1 wait beside it, paused. */
  distance: number;
  layout: ShortsActionsLayout;
  ended: boolean;
  playback: ReturnType<typeof useShortsPlayback>;
  onPrevious: (() => void) | undefined;
  onNext: (() => void) | undefined;
  renderComments: (videoId: string) => ReactNode;
}

const PRELOADED = 1;

/**
 * One Short of the feed, as tall as the feed: the one on screen plays with its controls, the one before
 * and the one after are mounted paused so a step finds the player built, and the others hold their place.
 */
export function ShortsSlide({
  short,
  distance,
  layout,
  ended,
  playback,
  onPrevious,
  onNext,
  renderComments,
}: ShortsSlideProps) {
  const { tOr } = useT();
  const api = useApi();
  const [buffering, setBuffering] = useState(false);
  const active = distance === 0;
  const { data: captions } = useQuery({ ...captionsQueryOptions(api, short.id), enabled: active });
  const title = short.title ?? tOr('browse.untitled', {}, '');
  const channel = short.channel;

  const slide = 'flex h-full snap-start snap-always items-center justify-center';
  if (Math.abs(distance) > PRELOADED) {
    return <div data-slot="shorts-slide" aria-hidden="true" className={slide} />;
  }

  const state = active && ended ? 'ended' : active && buffering ? 'loading' : 'ready';

  return (
    <div
      data-slot="shorts-slide"
      role="group"
      aria-roledescription="slide"
      aria-label={title}
      aria-hidden={active ? undefined : true}
      inert={!active}
      className={slide}
    >
      <PlayerChannelProvider>
        <ShortsPlayerFrame.Root
          state={state}
          layout={layout}
          className="h-full items-center"
          playback={{ paused: playback.paused, onTogglePlay: playback.togglePlay }}
          onPrevious={onPrevious}
          onNext={onNext}
        >
          <ShortsPlayerFrame.Player>
            <ShortsFeedPlayer
              short={short}
              captionTracks={captions?.tracks}
              control={{
                paused: !active || playback.paused,
                muted: !active || playback.muted,
                speed: playback.speed,
                captions: active && playback.captions,
              }}
              onPlay={() => {
                if (active) {
                  setBuffering(false);
                  playback.setPaused(false);
                }
              }}
              onPause={() => active && playback.setPaused(true)}
              onWaiting={() => active && setBuffering(true)}
            />
            <ShortsPlayerFrame.Caption>
              <div className="flex items-center gap-inline text-label">
                {channel?.displayName}
                {channel && <SubscribeAction channelId={channel.id} />}
              </div>
              <p className="m-0 text-body-sm">{title}</p>
            </ShortsPlayerFrame.Caption>
            {active && (
              <>
                <ShortsFeedProgress durationMs={short.durationMs ?? 0} />
                <ShortsFeedControls
                  muted={playback.muted}
                  onToggleMute={playback.toggleMute}
                  captions={playback.captions}
                  hasCaptions={captions?.tracks.some(({ status }) => status === 'ready') ?? false}
                  onToggleCaptions={playback.toggleCaptions}
                  speed={playback.speed}
                  onSpeedChange={playback.setSpeed}
                />
              </>
            )}
          </ShortsPlayerFrame.Player>
          {active && <ShortsFeedActions short={short} renderComments={renderComments} />}
        </ShortsPlayerFrame.Root>
      </PlayerChannelProvider>
    </div>
  );
}
