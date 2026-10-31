import type { ComponentPropsWithRef } from 'react';
import { VideoThumbnail } from '../video-thumbnail';
import { useVideoCard } from './video-card.context';
import { videoCardStyles } from './video-card.variants';

export interface VideoCardThumbProps extends ComponentPropsWithRef<'div'> {
  src?: string;
  alt?: string;
  /** The formatted clock text, `18:42`. */
  duration?: string;
  /** The duration as a screen reader says it, `18 minutes 42 seconds`. */
  spokenDuration?: string;
  /** How much was watched, 0 to 1. */
  progress?: number;
  /** A short muted clip that plays while the card is expanded, paused under reduced motion. */
  previewSrc?: string;
}

/** The frame, from `VideoThumbnail`; its children are `Badge`s for the start-top corner. */
export function VideoCardThumb({
  src,
  alt,
  duration,
  spokenDuration,
  progress,
  previewSrc,
  className,
  children,
  ...props
}: VideoCardThumbProps) {
  const shared = useVideoCard('Thumb');
  const styles = videoCardStyles(shared);
  const unavailable = shared.state === 'unavailable';

  return (
    <VideoThumbnail.Root
      data-slot="video-card-thumb"
      aspect={shared.variant === 'poster' ? 'poster' : 'video'}
      videoId={shared.videoId}
      className={styles.thumb({ className })}
      {...props}
    >
      <VideoThumbnail.Image src={unavailable ? undefined : src} alt={alt} />
      {shared.expanded && previewSrc !== undefined && (
        <video
          data-slot="video-card-preview"
          muted
          loop
          playsInline
          className={styles.preview()}
          ref={(node) => {
            if (node === null || node.src !== '') return;
            node.autoplay = node.closest('[data-motion=reduced]') === null;
            node.src = previewSrc;
          }}
        />
      )}
      {children !== undefined && <VideoThumbnail.Badge>{children}</VideoThumbnail.Badge>}
      {shared.state === 'live' && <VideoThumbnail.Live />}
      {duration !== undefined && (
        <VideoThumbnail.Duration spoken={spokenDuration}>{duration}</VideoThumbnail.Duration>
      )}
      {progress !== undefined && <VideoThumbnail.Progress value={progress} />}
    </VideoThumbnail.Root>
  );
}
