import { useUiCopy } from '@vp/ui';
import type { ComponentPropsWithRef, KeyboardEvent, PointerEvent } from 'react';
import { useNowPlayingBar } from './now-playing-bar.context';
import { nowPlayingBarStyles } from './now-playing-bar.variants';

const DEFAULT_SEEK_STEP = 0.01;

export interface NowPlayingBarProgressProps
  extends Omit<ComponentPropsWithRef<'div'>, 'role' | 'children'> {
  /** The position in words, "4 minutes 12 seconds of 18 minutes 42 seconds". */
  valueText: string;
  /** The fraction one arrow press seeks; the app passes 5 seconds of the video's length. */
  step?: number;
}

const clamp = (fraction: number) => Math.min(1, Math.max(0, fraction));

/** The 2 px bar flush with the top edge, a slider over a 12 px hit area; absent while live. */
export function NowPlayingBarProgress({
  valueText,
  step = DEFAULT_SEEK_STEP,
  className,
  ...props
}: NowPlayingBarProgressProps) {
  const { progress, status, onSeek } = useNowPlayingBar('Progress');
  const { seek } = useUiCopy();
  const styles = nowPlayingBarStyles();

  if (status === 'live') {
    return null;
  }

  const seekToPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width > 0) {
      onSeek(clamp((event.clientX - box.left) / box.width));
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    seekToPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      seekToPointer(event);
    }
  };

  const keyTargets: Record<string, number> = {
    ArrowRight: progress + step,
    ArrowUp: progress + step,
    ArrowLeft: progress - step,
    ArrowDown: progress - step,
    Home: 0,
    End: 1,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = keyTargets[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    onSeek(clamp(target));
  };

  return (
    <div
      data-slot="now-playing-bar-progress"
      role="slider"
      tabIndex={0}
      dir="ltr"
      aria-label={seek}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp(progress) * 100)}
      aria-valuetext={valueText}
      className={styles.seek({ className })}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <div className={styles.track()}>
        <div className={styles.fill()} style={{ inlineSize: `${clamp(progress) * 100}%` }} />
      </div>
    </div>
  );
}
