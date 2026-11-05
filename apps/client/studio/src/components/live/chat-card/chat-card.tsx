import { cn } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** One chat line over video, popped in and still under reduced motion. */
export function ChatCardRoot({ className, ...props }: ComponentPropsWithRef<'article'>) {
  return (
    <article
      data-slot="chat-card"
      className={cn(
        'tw:flex tw:flex-col tw:gap-1 tw:rounded-card tw:bg-scrim tw:px-inset-card tw:py-inset-control tw:text-fg tw:motion-safe:animate-pop-in',
        className
      )}
      {...props}
    />
  );
}

export function ChatCardAuthor({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="chat-card-author"
      className={cn('tw:m-0 tw:text-label tw:text-fg-muted', className)}
      {...props}
    />
  );
}

export function ChatCardText({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="chat-card-text"
      className={cn('tw:m-0 tw:text-body tw:break-words', className)}
      {...props}
    />
  );
}
