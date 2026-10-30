import { AspectRatio, Button, Icon, IconButton, Progress, Skeleton, Slot, useUiCopy } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type SyntheticEvent,
  useRef,
  useState,
} from 'react';
import { ShortsPlayerFrameContext, useShortsPlayerFrame } from './shorts-player-frame.context';
import { shortsPlayerFrameStyles } from './shorts-player-frame.variants';
import type {
  ShortsActionsLayout,
  ShortsDirection,
  ShortsFrameState,
  ShortsPlayback,
} from './types';

const SWIPE_PX = 48;
const SKELETON_ACTIONS = ['like', 'discussion', 'share', 'queue'];

function ownsKeystrokes(target: EventTarget) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** A portalled sheet or dialog bubbles its events through React to the frame, though it is not in it. */
function isInside(event: SyntheticEvent<HTMLElement>) {
  return event.currentTarget.contains(event.target as Node);
}

export interface ShortsPlayerFrameRootProps extends ComponentPropsWithRef<'section'> {
  state?: ShortsFrameState;
  layout?: ShortsActionsLayout;
  /** Play, pause and mute, from the wrapper's player; Space and M reach them from anywhere in the frame. */
  playback?: ShortsPlayback;
  onPrevious?: () => void;
  onNext?: () => void;
}

/** The Shorts surface: the 9:16 player on the stage, its actions, and previous and next where there are any. */
export function ShortsPlayerFrameRoot({
  state = 'ready',
  layout = 'beside',
  playback,
  onPrevious,
  onNext,
  className,
  children,
  onKeyDown,
  ...props
}: ShortsPlayerFrameRootProps) {
  const [entered, setEntered] = useState<ShortsDirection>();
  const touchStart = useRef<number | undefined>(undefined);
  const { shortsPlayer, previousShort, nextShort } = useUiCopy();
  const styles = shortsPlayerFrameStyles({ layout });
  const canGoNext = onNext !== undefined && state !== 'ended';

  const go = (direction: ShortsDirection) => {
    const move = direction === 'next' ? (canGoNext ? onNext : undefined) : onPrevious;
    if (!move) {
      return;
    }
    setEntered(direction);
    move();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !isInside(event) || ownsKeystrokes(event.target)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'arrowdown' || key === 'j') {
      go('next');
    } else if (key === 'arrowup' || key === 'k') {
      go('previous');
    } else if (key === 'm' && playback) {
      playback.onToggleMute();
    } else if (key === ' ' && playback && !(event.target instanceof HTMLButtonElement)) {
      playback.onTogglePlay();
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <ShortsPlayerFrameContext
      value={{
        state,
        layout,
        paused: playback?.paused ?? false,
        muted: playback?.muted ?? false,
        playback,
        entered,
      }}
    >
      <section
        data-slot="shorts-player-frame"
        data-state={state}
        aria-label={shortsPlayer}
        className={styles.root({ className })}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onTouchStart={(event) => {
          if (!isInside(event)) {
            return;
          }
          touchStart.current = event.touches[0]?.clientY;
        }}
        onTouchEnd={(event) => {
          if (!isInside(event)) {
            return;
          }
          const start = touchStart.current;
          const end = event.changedTouches[0]?.clientY;
          if (start === undefined || end === undefined || Math.abs(start - end) < SWIPE_PX) {
            return;
          }
          go(start > end ? 'next' : 'previous');
        }}
        {...props}
      >
        {(onPrevious || onNext) && layout === 'beside' && (
          <div data-slot="shorts-player-frame-nav" className={styles.nav()}>
            <IconButton
              size="lg"
              variant="soft"
              aria-label={previousShort}
              disabled={!onPrevious}
              onClick={() => go('previous')}
            >
              <Icon name="chevron-down" className="tw:rotate-180" />
            </IconButton>
            <IconButton
              size="lg"
              variant="soft"
              aria-label={nextShort}
              disabled={!canGoNext}
              onClick={() => go('next')}
            >
              <Icon name="chevron-down" />
            </IconButton>
          </div>
        )}
        {children}
      </section>
    </ShortsPlayerFrameContext>
  );
}

/** Shown in place of the media when it failed: the wrapper's words, and a retry. */
export function ShortsPlayerFrameError({
  onRetry,
  className,
  children,
  ...props
}: ComponentPropsWithRef<'div'> & { onRetry: () => void }) {
  const { state, layout } = useShortsPlayerFrame('Error');
  const { retry } = useUiCopy();

  if (state !== 'error') {
    return null;
  }

  return (
    <div
      data-slot="shorts-player-frame-error"
      role="alert"
      className={shortsPlayerFrameStyles({ layout }).centre({ className })}
      {...props}
    >
      <Icon name="alert" size="lg" />
      <p className="tw:m-0">{children}</p>
      <Button variant="soft" onClick={onRetry}>
        {retry}
      </Button>
    </div>
  );
}

export interface ShortsPlayerFrameCaptionProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The title and channel, over the bottom of the frame. */
export function ShortsPlayerFrameCaption({
  asChild = false,
  className,
  ...props
}: ShortsPlayerFrameCaptionProps) {
  const { layout } = useShortsPlayerFrame('Caption');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="shorts-player-frame-caption"
      className={shortsPlayerFrameStyles({ layout }).caption({ className })}
      {...props}
    />
  );
}

export interface ShortsPlayerFrameProgressProps {
  /** How much has played, 0 to 1. */
  value: number;
  className?: string;
}

export function ShortsPlayerFrameProgress({ value, className }: ShortsPlayerFrameProgressProps) {
  const { layout } = useShortsPlayerFrame('Progress');

  return (
    <Progress
      aria-hidden="true"
      tone="accent"
      value={Math.round(Math.min(1, Math.max(0, value)) * 100)}
      className={shortsPlayerFrameStyles({ layout }).progress({ className })}
    />
  );
}

export function ShortsPlayerFrameSkeleton({ layout = 'beside' }: { layout?: ShortsActionsLayout }) {
  const styles = shortsPlayerFrameStyles({ layout });

  return (
    <div data-slot="shorts-player-frame-skeleton" aria-hidden="true" className={styles.root()}>
      <div className={styles.frame({ className: 'tw:shadow-none' })}>
        {layout === 'beside' ? (
          <AspectRatio shape="poster">
            <Skeleton radius="card" className="tw:size-full" />
          </AspectRatio>
        ) : (
          <Skeleton radius="card" className="tw:size-full" />
        )}
      </div>
      <div className={styles.actions({ className: 'tw:gap-[1rem]' })}>
        {SKELETON_ACTIONS.map((action) => (
          <Skeleton key={action} shape="circle" className="tw:size-control-lg" />
        ))}
      </div>
    </div>
  );
}
