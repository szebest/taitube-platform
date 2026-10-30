import { Badge, Icon, Progress, Skeleton, Slot, useUiCopy, VisuallyHidden } from '@vp/ui';
import { type ComponentPropsWithRef, type CSSProperties, useState } from 'react';
import type { VideoThumbnailAspect } from './types';
import { useVideoThumbnail, VideoThumbnailContext } from './video-thumbnail.context';
import { videoThumbnailStyles } from './video-thumbnail.variants';

const PERCENT = 100;

/** The shared-element name a video's frame carries, so a thumbnail and the watch stage morph into each other. */
export function videoTransitionName(videoId: string): string {
  return `video-${videoId}`;
}

export interface VideoThumbnailRootProps extends ComponentPropsWithRef<'div'> {
  aspect?: VideoThumbnailAspect;
  /** Names the frame for the view transition into the stage; omit where no stage follows. */
  videoId?: string;
}

export function VideoThumbnailRoot({
  aspect = 'video',
  videoId,
  className,
  style,
  ...props
}: VideoThumbnailRootProps) {
  const transition: CSSProperties | undefined =
    videoId === undefined ? undefined : { viewTransitionName: videoTransitionName(videoId) };

  return (
    <VideoThumbnailContext value={{ aspect, videoId }}>
      <div
        data-slot="video-thumbnail"
        data-video-id={videoId}
        className={videoThumbnailStyles({ aspect }).root({ className })}
        style={{ ...transition, ...style }}
        {...props}
      />
    </VideoThumbnailContext>
  );
}

export interface VideoThumbnailImageProps extends ComponentPropsWithRef<'img'> {
  asChild?: boolean;
}

/** Decorative by default, since the title beside it names the video; with no `src`, a placeholder for a video still processing. */
export function VideoThumbnailImage({
  asChild = false,
  src,
  alt = '',
  className,
  onLoad,
  ...props
}: VideoThumbnailImageProps) {
  const { aspect } = useVideoThumbnail('Image');
  const [loaded, setLoaded] = useState(false);
  const styles = videoThumbnailStyles({ aspect });

  if (src === undefined && !asChild) {
    return (
      <div data-slot="video-thumbnail-placeholder" className={styles.placeholder()}>
        <Icon name="video" size="lg" />
      </div>
    );
  }

  const Element = asChild ? Slot.Root : 'img';

  return (
    <Element
      data-slot="video-thumbnail-image"
      data-loaded={loaded || undefined}
      ref={(node: HTMLImageElement | null) => {
        if (node?.complete && node.naturalWidth > 0) setLoaded(true);
      }}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      className={styles.image({ className })}
      {...props}
    />
  );
}

/** Start-top: the caller's `Badge`s (4K, NEW, a status); the part only places them. */
export function VideoThumbnailBadge({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { aspect } = useVideoThumbnail('Badge');

  return (
    <div
      data-slot="video-thumbnail-badge"
      className={videoThumbnailStyles({ aspect }).badges({ className })}
      {...props}
    />
  );
}

export interface VideoThumbnailDurationProps extends ComponentPropsWithRef<'span'> {
  /** What a screen reader says in place of the clock text ("18 minutes 42 seconds"). */
  spoken?: string;
}

/** The app's formatted clock text; hidden while the frame shows `Live`. */
export function VideoThumbnailDuration({
  spoken,
  className,
  children,
  ...props
}: VideoThumbnailDurationProps) {
  const { aspect } = useVideoThumbnail('Duration');

  return (
    <>
      <span
        data-slot="video-thumbnail-duration"
        aria-hidden={spoken === undefined ? undefined : true}
        className={videoThumbnailStyles({ aspect }).duration({ className })}
        {...props}
      >
        {children}
      </span>
      {spoken !== undefined && <VisuallyHidden>{spoken}</VisuallyHidden>}
    </>
  );
}

export interface VideoThumbnailProgressProps
  extends Omit<ComponentPropsWithRef<typeof Progress>, 'value' | 'max'> {
  /** How much was watched, 0 to 1; nothing renders at 0. */
  value: number;
}

export function VideoThumbnailProgress({
  value,
  className,
  ...props
}: VideoThumbnailProgressProps) {
  const { aspect } = useVideoThumbnail('Progress');
  const { watched } = useUiCopy();
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * PERCENT);

  if (percent === 0) {
    return null;
  }

  return (
    <Progress
      data-slot="video-thumbnail-progress"
      size="sm"
      tone="accent"
      value={percent}
      aria-label={watched}
      className={videoThumbnailStyles({ aspect }).progress({ className })}
      {...props}
    />
  );
}

/** End-top: the `Live` badge, in place of the duration and the progress. */
export function VideoThumbnailLive({ className, ...props }: ComponentPropsWithRef<'span'>) {
  const { aspect } = useVideoThumbnail('Live');
  const { live } = useUiCopy();

  return (
    <span
      data-slot="video-thumbnail-live"
      className={videoThumbnailStyles({ aspect }).live({ className })}
      {...props}
    >
      <Badge variant="solid" tone="live">
        {live}
      </Badge>
    </span>
  );
}

export function VideoThumbnailSkeleton({
  aspect = 'video',
  className,
}: Pick<VideoThumbnailRootProps, 'aspect' | 'className'>) {
  return (
    <Skeleton
      data-slot="video-thumbnail-skeleton"
      radius="thumb"
      className={videoThumbnailStyles({ aspect }).root({
        className: ['tw:after:hidden', className],
      })}
    />
  );
}
