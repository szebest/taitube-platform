import { AspectRatio, Button, Icon, IconButton, Skeleton, Slider, Slot, useUiCopy } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { ShortsPlayerFrameContext, useShortsPlayerFrame } from './shorts-player-frame.context';
import { shortsPlayerFrameStyles } from './shorts-player-frame.variants';
import type { ShortsActionsLayout, ShortsFrameState, ShortsPlayback } from './types';

const SKELETON_ACTIONS = ['like', 'discussion', 'share', 'queue'];

export interface ShortsPlayerFrameRootProps extends ComponentPropsWithRef<'div'> {
  state?: ShortsFrameState;
  layout?: ShortsActionsLayout;
  /** Play and pause from the press surface; the feed owns the keys. */
  playback?: ShortsPlayback;
  onPrevious?: () => void;
  onNext?: () => void;
}

/** One Short's surface: the 9:16 player on the stage, its actions, and previous and next where there are any. */
export function ShortsPlayerFrameRoot({
  state = 'ready',
  layout = 'beside',
  playback,
  onPrevious,
  onNext,
  className,
  children,
  ...props
}: ShortsPlayerFrameRootProps) {
  const { previousShort, nextShort } = useUiCopy();
  const styles = shortsPlayerFrameStyles({ layout });

  return (
    <ShortsPlayerFrameContext
      value={{
        state,
        layout,
        paused: playback?.paused ?? false,
        playback,
      }}
    >
      <div
        data-slot="shorts-player-frame"
        data-state={state}
        className={styles.root({ className })}
        {...props}
      >
        {(onPrevious || onNext) && layout === 'beside' && (
          <div data-slot="shorts-player-frame-nav" className={styles.nav()}>
            <IconButton
              size="lg"
              variant="soft"
              aria-label={previousShort}
              disabled={!onPrevious}
              onClick={onPrevious}
            >
              <Icon name="chevron-down" className="rotate-180" />
            </IconButton>
            <IconButton
              size="lg"
              variant="soft"
              aria-label={nextShort}
              disabled={!onNext || state === 'ended'}
              onClick={onNext}
            >
              <Icon name="chevron-down" />
            </IconButton>
          </div>
        )}
        {children}
      </div>
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
      <p className="m-0">{children}</p>
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
  /** Names the bar for a screen reader; the bar is a slider the viewer can drag or arrow along. */
  label: string;
  /** Where the viewer asks to go, 0 to 1. */
  onSeek: (fraction: number) => void;
  className?: string;
}

const PERCENT = 100;
const SEEK_STEP_PERCENT = 1;

export function ShortsPlayerFrameProgress({
  value,
  label,
  onSeek,
  className,
}: ShortsPlayerFrameProgressProps) {
  const { layout } = useShortsPlayerFrame('Progress');
  const percent = Math.round(Math.min(1, Math.max(0, value)) * PERCENT);

  return (
    <Slider.Root
      size="sm"
      tone="accent"
      value={[percent]}
      min={0}
      max={PERCENT}
      step={SEEK_STEP_PERCENT}
      className={shortsPlayerFrameStyles({ layout }).progress({ className })}
      onValueChange={([next]) => next !== undefined && onSeek(next / PERCENT)}
    >
      <Slider.Thumb
        aria-label={label}
        className="opacity-0 transition-opacity duration-fast focus-visible:opacity-100 motion-reduce:transition-none"
      />
    </Slider.Root>
  );
}

export interface ShortsPlayerFrameToolbarProps extends ComponentPropsWithRef<'div'> {
  /** Names the toolbar for a screen reader. */
  label: string;
}

/** The controls over the picture's top corner: mute, captions, speed. */
export function ShortsPlayerFrameToolbar({
  label,
  className,
  ...props
}: ShortsPlayerFrameToolbarProps) {
  const { layout } = useShortsPlayerFrame('Toolbar');

  return (
    <div
      data-slot="shorts-player-frame-toolbar"
      role="toolbar"
      aria-label={label}
      className={shortsPlayerFrameStyles({ layout }).toolbar({ className })}
      {...props}
    />
  );
}

export function ShortsPlayerFrameSkeleton({ layout = 'beside' }: { layout?: ShortsActionsLayout }) {
  const styles = shortsPlayerFrameStyles({ layout });

  return (
    <div data-slot="shorts-player-frame-skeleton" aria-hidden="true" className={styles.root()}>
      <div className={styles.frame({ className: 'shadow-none' })}>
        {layout === 'beside' ? (
          <AspectRatio shape="poster">
            <Skeleton radius="card" className="size-full" />
          </AspectRatio>
        ) : (
          <Skeleton radius="card" className="size-full" />
        )}
      </div>
      <div className={styles.actions({ className: 'gap-[1rem]' })}>
        {SKELETON_ACTIONS.map((action) => (
          <Skeleton key={action} shape="circle" className="size-control-lg" />
        ))}
      </div>
    </div>
  );
}
