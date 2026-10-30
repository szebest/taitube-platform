import { AspectRatio, Icon, IconButton, Spinner, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, type ReactNode, useEffect, useState } from 'react';
import { useShortsPlayerFrame } from './shorts-player-frame.context';
import { shortsPlayerFrameStyles } from './shorts-player-frame.variants';

const SPINNER_DELAY_MS = 400;

export interface ShortsPlayerFramePlayerProps extends ComponentPropsWithRef<'div'> {
  /** The wrapper's media element (or the empty state's content), drawn edge to edge. */
  children?: ReactNode;
}

/** The 9:16 frame: the media, a press surface that plays and pauses, the paused and muted markers. */
export function ShortsPlayerFramePlayer({
  className,
  children,
  ...props
}: ShortsPlayerFramePlayerProps) {
  const { state, layout, paused, muted, playback, entered } = useShortsPlayerFrame('Player');
  const { play, pause, unmute, caughtUp } = useUiCopy();
  const [spinnerDue, setSpinnerDue] = useState(false);
  const styles = shortsPlayerFrameStyles({ layout });
  const plays = state === 'ready' || state === 'ended';

  useEffect(() => {
    if (state !== 'loading') {
      setSpinnerDue(false);
      return;
    }
    const timer = window.setTimeout(() => setSpinnerDue(true), SPINNER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const frame = (
    <>
      <div data-slot="shorts-player-frame-media" className={styles.media()}>
        {state !== 'empty' && children}
      </div>
      {plays && playback && (
        <button
          type="button"
          data-slot="shorts-player-frame-surface"
          aria-label={paused ? play : pause}
          className={styles.surface()}
          onClick={playback.onTogglePlay}
        >
          {paused && (
            <span className={styles.paused()}>
              <Icon name="play" size="lg" />
            </span>
          )}
        </button>
      )}
      {plays && muted && playback && (
        <IconButton
          size="sm"
          aria-label={unmute}
          className={styles.muted()}
          onClick={playback.onToggleMute}
        >
          <Icon name="volume" />
        </IconButton>
      )}
      {state === 'loading' && spinnerDue && (
        <div className={styles.centre()}>
          <Spinner size="lg" />
        </div>
      )}
      {state === 'empty' && <div className={styles.centre()}>{children}</div>}
      {state === 'ended' && (
        <p role="status" className={styles.notice()}>
          {caughtUp}
        </p>
      )}
    </>
  );

  return (
    <div
      data-slot="shorts-player-frame-player"
      data-enter={entered}
      data-state={state}
      className={styles.frame({ className })}
      {...props}
    >
      {layout === 'beside' ? <AspectRatio shape="poster">{frame}</AspectRatio> : frame}
    </div>
  );
}
