import { Avatar, Icon, Slot } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import type { VideoCardSize, VideoCardState, VideoCardVariant } from './types';
import { useVideoCardHover } from './use-video-card-hover';
import { useVideoCard, VideoCardContext } from './video-card.context';
import { videoCardStyles } from './video-card.variants';

const EXPANDABLE: ReadonlySet<VideoCardVariant> = new Set(['grid', 'shelf']);

export interface VideoCardRootProps extends ComponentPropsWithRef<'article'> {
  variant?: VideoCardVariant;
  state?: VideoCardState;
  /** Only `row` reads it: `sm` is the queue's narrower thumbnail. */
  size?: VideoCardSize;
  videoId?: string;
}

/**
 * One video as a card. A mouse resting on a `grid` or `shelf` card for 500 ms expands it in place;
 * leaving or scrolling cancels it, and touch and keyboard never expand.
 */
export function VideoCardRoot({
  variant = 'grid',
  state = 'rest',
  size = 'md',
  videoId,
  className,
  onPointerEnter,
  onPointerLeave,
  ...props
}: VideoCardRootProps) {
  const { expanded, wait, cancel } = useVideoCardHover();

  return (
    <VideoCardContext value={{ variant, state, size, videoId, expanded }}>
      <article
        data-slot="video-card"
        data-variant={variant}
        data-expanded={expanded || undefined}
        className={videoCardStyles({ variant, state, size }).root({ className })}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (event.pointerType === 'mouse' && EXPANDABLE.has(variant)) wait();
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          cancel();
        }}
        {...props}
      />
    </VideoCardContext>
  );
}

export interface VideoCardBylineProps extends ComponentPropsWithRef<'div'> {
  name: string;
  avatarSrc?: string;
  /** The channel link the wrapper passes as the single, empty child; the avatar and name go inside it. */
  asChild?: boolean;
}

export function VideoCardByline({
  name,
  avatarSrc,
  asChild = false,
  className,
  children,
  ...props
}: VideoCardBylineProps) {
  const shared = useVideoCard('Byline');
  const styles = videoCardStyles(shared);
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element data-slot="video-card-byline" className={styles.byline({ className })} {...props}>
      <Avatar.Root size="xs" className={styles.avatar()}>
        {avatarSrc !== undefined && <Avatar.Image src={avatarSrc} alt="" />}
        <Avatar.Fallback aria-hidden="true">
          <Icon name="you" size="sm" />
        </Avatar.Fallback>
      </Avatar.Root>
      <Slot.Slottable>{children}</Slot.Slottable>
      {name}
    </Element>
  );
}

export interface VideoCardTitleProps extends ComponentPropsWithRef<'span'> {
  /** The link to the video the wrapper passes; it is stretched over the whole card. */
  asChild?: boolean;
}

export function VideoCardTitle({ asChild = false, className, ...props }: VideoCardTitleProps) {
  const shared = useVideoCard('Title');
  const Element = asChild ? Slot.Root : 'span';

  return (
    <Element
      data-slot="video-card-title"
      aria-disabled={shared.state === 'unavailable' || undefined}
      className={videoCardStyles(shared).title({ className })}
      {...props}
    />
  );
}

export function VideoCardMeta({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useVideoCard('Meta');

  return (
    <p
      data-slot="video-card-meta"
      className={videoCardStyles(shared).meta({ className })}
      {...props}
    />
  );
}

/** A line or two of the video's description, under the meta; only `row` lays it out. */
export function VideoCardSnippet({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useVideoCard('Snippet');
  return (
    <p
      data-slot="video-card-snippet"
      className={videoCardStyles(shared).snippet({ className })}
      {...props}
    />
  );
}

/** Why this video is here, under a shelf's heading. */
export function VideoCardReason({ className, children, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useVideoCard('Reason');
  const styles = videoCardStyles(shared);

  return (
    <p data-slot="video-card-reason" className={styles.reason({ className })} {...props}>
      <span aria-hidden="true" className={styles.reasonDot()} />
      {children}
    </p>
  );
}
