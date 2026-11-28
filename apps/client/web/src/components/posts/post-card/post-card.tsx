import { Avatar, Badge, Card, cn, Icon } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import { type ComponentPropsWithRef, Fragment, type ReactNode, useId } from 'react';
import { useT } from '#app/lib/messages';
import { PostCardContext, usePostCard } from './post-card.context';
import { linkify } from './utils/linkify';

export interface PostCardRootProps extends ComponentPropsWithRef<'article'> {
  /** The channel's name, which names the article for assistive tech. */
  channelName: string;
}

/** One channel post: the header, the body, and the actions under it. */
export function PostCardRoot({ channelName, className, ...props }: PostCardRootProps) {
  const authorId = useId();
  const { tOr } = useT();

  return (
    <PostCardContext value={{ authorId }}>
      <Card.Root asChild variant="solid">
        <article
          data-slot="post-card"
          aria-label={tOr('posts.postBy', { channel: channelName }, '')}
          className={className}
          {...props}
        />
      </Card.Root>
    </PostCardContext>
  );
}

export interface PostCardHeaderProps extends Omit<ComponentPropsWithRef<'header'>, 'children'> {
  channelId: string;
  name: string;
  avatarSrc?: string;
  /** When it was published, finished by the app. */
  time: string;
  dateTime: string;
  /** `PostCard.Pinned` and `PostCard.Edited`, after the time. */
  children?: ReactNode;
}

/** The channel that published it and when. */
export function PostCardHeader({
  channelId,
  name,
  avatarSrc,
  time,
  dateTime,
  children,
  className,
  ...props
}: PostCardHeaderProps) {
  const { authorId } = usePostCard('Header');

  return (
    <header
      data-slot="post-card-header"
      className={cn('flex items-center gap-stack', className)}
      {...props}
    >
      <Avatar.Root size="md">
        {avatarSrc && <Avatar.Image src={avatarSrc} alt="" />}
        <Avatar.Fallback aria-hidden="true">{name.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <div className="flex min-w-0 flex-wrap items-center gap-x-inline gap-y-1">
        <Link
          id={authorId}
          to="/channel/$channelId"
          params={{ channelId }}
          className="focus-ring rounded-xs text-label text-fg no-underline hover:underline"
        >
          {name}
        </Link>
        <time dateTime={dateTime} className="text-caption text-fg-muted">
          {time}
        </time>
        {children}
      </div>
    </header>
  );
}

export function PostCardPinned() {
  const { tOr } = useT();

  return (
    <Badge size="sm" tone="neutral">
      <Icon name="pin" size="sm" />
      {tOr('posts.pinned', {}, '')}
    </Badge>
  );
}

export function PostCardEdited() {
  const { tOr } = useT();

  return <span className="text-caption text-fg-muted">{tOr('appUi.edited', {}, '')}</span>;
}

export function PostCardBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="post-card-body"
      className={cn('flex min-w-0 flex-col gap-stack', className)}
      {...props}
    />
  );
}

export interface PostCardTextProps extends ComponentPropsWithRef<'p'> {
  text: string;
}

/** Plain text in which an `https` link is a link and nothing else is markup. */
export function PostCardText({ text, className, ...props }: PostCardTextProps) {
  return (
    <p
      data-slot="post-card-text"
      className={cn(
        'm-0 max-w-reading-max text-body break-words whitespace-pre-line select-text',
        className
      )}
      {...props}
    >
      {linkify(text).map((part) =>
        part.kind === 'link' ? (
          <a
            key={part.start}
            href={part.href}
            target="_blank"
            rel="nofollow noopener ugc"
            className="text-accent-ink underline"
          >
            {part.text}
          </a>
        ) : (
          <Fragment key={part.start}>{part.text}</Fragment>
        )
      )}
    </p>
  );
}

export interface PostCardMediaProps extends ComponentPropsWithRef<'div'> {
  images: readonly { alt: string; urls: { w640: string; w1280: string } }[];
}

const IMAGE_SIZES = '(min-width: 900px) 640px, 100vw';

/** One to four images through the pipeline's two widths. */
export function PostCardMedia({ images, className, ...props }: PostCardMediaProps) {
  return (
    <div
      data-slot="post-card-media"
      data-count={images.length}
      className={cn(
        'grid gap-1 overflow-hidden rounded-card',
        images.length > 1 && 'grid-cols-2',
        className
      )}
      {...props}
    >
      {images.map(({ alt, urls }) => (
        <img
          key={urls.w640}
          src={urls.w640}
          srcSet={`${urls.w640} 640w, ${urls.w1280} 1280w`}
          sizes={IMAGE_SIZES}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="aspect-video size-full object-cover"
        />
      ))}
    </div>
  );
}

export function PostCardActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="post-card-actions"
      className={cn('-ms-inline flex flex-wrap items-center gap-1', className)}
      {...props}
    />
  );
}
