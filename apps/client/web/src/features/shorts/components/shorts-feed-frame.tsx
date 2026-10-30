import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useMediaQuery, VisuallyHidden } from '@vp/ui';
import { useState } from 'react';

import { ShortsPlayerFrame } from '#app/components/shorts/shorts-player-frame';
import { useReducedMotion } from '#app/hooks/use-reduced-motion';

import { useShortsNavigation } from '../hooks/use-shorts-navigation';
import { useWheelStep } from '../hooks/use-wheel-step';
import { ShortsFeedActions } from './shorts-feed-actions';
import { ShortsFeedPlayer } from './shorts-feed-player';

const ACTIONS_BESIDE = '(min-width: 600px)';

export interface ShortsFeedFrameProps {
  short: VideoSummary;
}

/**
 * One Short in the Shorts player: it starts muted and playing, paused under the `reduced` motion set,
 * and the move to the next or previous Short is announced.
 */
export function ShortsFeedFrame({ short }: ShortsFeedFrameProps) {
  const { tOr } = useT();
  const reduced = useReducedMotion();
  const beside = useMediaQuery(ACTIONS_BESIDE);
  const navigation = useShortsNavigation();
  const [paused, setPaused] = useState<boolean>();
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);

  const isPaused = paused ?? reduced;
  const state = navigation.ended ? 'ended' : buffering ? 'loading' : 'ready';
  const channel = short.channel?.displayName ?? '';
  const title = short.title ?? tOr('browse.untitled', {}, '');

  const startOver = (move: (() => void) | undefined) =>
    move &&
    (() => {
      setPaused(undefined);
      setBuffering(false);
      setProgress(0);
      move();
    });
  const onPrevious = startOver(navigation.previous);
  const onNext = startOver(navigation.next);
  const handleWheel = useWheelStep({ onPrevious, onNext });

  return (
    <ShortsPlayerFrame.Root
      state={state}
      layout={beside ? 'beside' : 'overlay'}
      playback={{
        paused: isPaused,
        muted,
        onTogglePlay: () => setPaused(!isPaused),
        onToggleMute: () => setMuted(!muted),
      }}
      onPrevious={onPrevious}
      onNext={onNext}
      onWheel={handleWheel}
    >
      <ShortsPlayerFrame.Player>
        <ShortsFeedPlayer
          key={short.id}
          short={short}
          control={{ paused: isPaused, muted }}
          onPlay={() => {
            setBuffering(false);
            setPaused(false);
          }}
          onPause={() => setPaused(true)}
          onWaiting={() => setBuffering(true)}
          onTimeUpdate={({ currentTime, duration }) => {
            setBuffering(false);
            setProgress(duration > 0 ? currentTime / duration : 0);
          }}
        />
        <ShortsPlayerFrame.Caption>
          <p className="tw:m-0 tw:text-label">{channel}</p>
          <p className="tw:m-0 tw:text-body-sm">{title}</p>
        </ShortsPlayerFrame.Caption>
        <ShortsPlayerFrame.Progress value={progress} />
      </ShortsPlayerFrame.Player>
      <ShortsFeedActions short={short} />
      <VisuallyHidden role="status">
        {tOr('shorts.announce', { title, channel }, '')}
      </VisuallyHidden>
    </ShortsPlayerFrame.Root>
  );
}
