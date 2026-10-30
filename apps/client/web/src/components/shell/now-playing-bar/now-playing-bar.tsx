import {
  Badge,
  Button,
  buttonStyles,
  Icon,
  IconButton,
  Skeleton,
  Slot,
  Spinner,
  useUiCopy,
  VisuallyHidden,
} from '@vp/ui';
import { type ComponentPropsWithRef, useId } from 'react';
import { NowPlayingBarContext, useNowPlayingBar } from './now-playing-bar.context';
import { nowPlayingBarStyles } from './now-playing-bar.variants';
import type { NowPlayingBarStatus } from './types';

const TRANSPORT_ICON = 'tw:rtl:scale-x-100';

type TransportButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children' | 'aria-label'>;

export interface NowPlayingBarRootProps extends ComponentPropsWithRef<'section'> {
  playing: boolean;
  progress: number;
  status?: NowPlayingBarStatus;
  onPlayPause: () => void;
  onSeek: (fraction: number) => void;
}

/** The bar along the content column that keeps the video playing; a region, not a live region. */
export function NowPlayingBarRoot({
  playing,
  progress,
  status = 'ready',
  onPlayPause,
  onSeek,
  className,
  ...props
}: NowPlayingBarRootProps) {
  const { nowPlaying } = useUiCopy();

  return (
    <NowPlayingBarContext value={{ playing, progress, status, onPlayPause, onSeek }}>
      <section
        data-slot="now-playing-bar"
        data-status={status}
        aria-label={nowPlaying}
        className={nowPlayingBarStyles().root({ className })}
        {...props}
      />
    </NowPlayingBarContext>
  );
}

/** The playing video's element, which the app hands in; hidden from assistive technology. */
export function NowPlayingBarMedia({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'div'>) {
  const { status } = useNowPlayingBar('Media');
  const styles = nowPlayingBarStyles({ status });

  return (
    <div data-slot="now-playing-bar-media" className={styles.media({ className })} {...props}>
      <div aria-hidden="true" className={styles.mediaSlot()}>
        {children}
      </div>
      {status === 'buffering' && <Spinner size="md" className={styles.buffering()} />}
    </div>
  );
}

export interface NowPlayingBarInfoProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

export function NowPlayingBarInfo({
  asChild = false,
  className,
  ...props
}: NowPlayingBarInfoProps) {
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="now-playing-bar-info"
      className={nowPlayingBarStyles().info({ className })}
      {...props}
    />
  );
}

/** One line; a hidden polite copy announces the next title when the track changes. */
export function NowPlayingBarTitle({ className, children, ...props }: ComponentPropsWithRef<'p'>) {
  const { status } = useNowPlayingBar('Title');

  return (
    <>
      <p
        data-slot="now-playing-bar-title"
        className={nowPlayingBarStyles({ status }).title({ className })}
        {...props}
      >
        {children}
      </p>
      <VisuallyHidden aria-live="polite">{children}</VisuallyHidden>
    </>
  );
}

export function NowPlayingBarSubtitle({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="now-playing-bar-subtitle"
      className={nowPlayingBarStyles().subtitle({ className })}
      {...props}
    />
  );
}

/** The time label where there is room for it; the live badge in its place while live. */
export function NowPlayingBarTime({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'span'>) {
  const { status } = useNowPlayingBar('Time');
  const { live } = useUiCopy();
  const styles = nowPlayingBarStyles();

  if (status === 'live') {
    return (
      <Badge tone="live" variant="solid" size="sm" className="tw:shrink-0">
        {live}
      </Badge>
    );
  }

  return (
    <span data-slot="now-playing-bar-time" className={styles.time({ className })} {...props}>
      {children}
    </span>
  );
}

/** The play and pause and the skip buttons; `dir="ltr"` because a transport does not mirror. */
export function NowPlayingBarTransport({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="now-playing-bar-transport"
      dir="ltr"
      className={nowPlayingBarStyles().transport({ className })}
      {...props}
    />
  );
}

export function NowPlayingBarPrevious({ className, ...props }: TransportButtonProps) {
  const { previous } = useUiCopy();

  return (
    <IconButton
      aria-label={previous}
      className={nowPlayingBarStyles().previous({ className })}
      {...props}
    >
      <Icon name="prev" className={TRANSPORT_ICON} />
    </IconButton>
  );
}

/** One button whose name switches; a retry while the video is unavailable. */
export function NowPlayingBarPlayPause(props: TransportButtonProps) {
  const { playing, status, onPlayPause } = useNowPlayingBar('PlayPause');
  const copy = useUiCopy();

  if (status === 'unavailable') {
    return (
      <IconButton aria-label={copy.retry} onClick={onPlayPause} {...props}>
        <Icon name="repeat" />
      </IconButton>
    );
  }

  return (
    <IconButton aria-label={playing ? copy.pause : copy.play} onClick={onPlayPause} {...props}>
      <Icon name={playing ? 'pause' : 'play'} />
    </IconButton>
  );
}

export function NowPlayingBarNext(props: TransportButtonProps) {
  const { next } = useUiCopy();

  return (
    <IconButton aria-label={next} {...props}>
      <Icon name="next" className={TRANSPORT_ICON} />
    </IconButton>
  );
}

export interface NowPlayingBarQueueProps extends TransportButtonProps {
  /** The finished position, "3 / 12"; read after the button's name. */
  count?: string;
}

export function NowPlayingBarQueue({ count, className, ...props }: NowPlayingBarQueueProps) {
  const { queue } = useUiCopy();
  const labelId = useId();
  const countId = useId();
  const styles = nowPlayingBarStyles();

  return (
    <Button
      variant="ghost"
      shape={count === undefined ? 'icon' : 'text'}
      aria-labelledby={count === undefined ? labelId : `${labelId} ${countId}`}
      className={styles.queue({ className })}
      {...props}
    >
      <Icon name="playlist" />
      <VisuallyHidden id={labelId}>{queue}</VisuallyHidden>
      {count !== undefined && (
        <span id={countId} className={styles.queueCount()}>
          {count}
        </span>
      )}
    </Button>
  );
}

export interface NowPlayingBarExpandProps extends ComponentPropsWithRef<'button'> {
  /** Takes the router link back to the watch page and draws the expand icon on it. */
  asChild?: boolean;
}

/** First in the tab order, drawn last. */
export function NowPlayingBarExpand({
  asChild = false,
  className,
  children,
  ...props
}: NowPlayingBarExpandProps) {
  const { backToVideo } = useUiCopy();
  const Element = asChild ? Slot.Root : 'button';

  return (
    <Element
      data-slot="now-playing-bar-expand"
      aria-label={backToVideo}
      className={buttonStyles({
        variant: 'ghost',
        shape: 'icon',
        className: nowPlayingBarStyles().expand({ className }),
      })}
      type={asChild ? undefined : 'button'}
      {...props}
    >
      <Icon name="expand" />
      <Slot.Slottable>{children}</Slot.Slottable>
    </Element>
  );
}

/** The bar at its size, for a placement that reserves it before the media is known. */
export function NowPlayingBarSkeleton() {
  const styles = nowPlayingBarStyles();

  return (
    <div data-slot="now-playing-bar-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton radius="sm" className={styles.media()} />
      <div className={styles.info({ className: 'tw:gap-inline' })}>
        <Skeleton shape="text" className="tw:w-3/5" />
        <Skeleton shape="text" className="tw:w-2/5" />
      </div>
      <Skeleton shape="circle" className="tw:size-control-md tw:shrink-0" />
      <Skeleton shape="circle" className="tw:size-control-md tw:shrink-0" />
    </div>
  );
}
