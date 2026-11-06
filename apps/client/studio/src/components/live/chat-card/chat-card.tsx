import { cn } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** One chat line over video, popped in and still under reduced motion. */
export function ChatCardRoot({ className, ...props }: ComponentPropsWithRef<'article'>) {
  return (
    <article
      data-slot="chat-card"
      className={cn(
        'flex flex-col gap-1 rounded-card bg-scrim px-inset-card py-inset-control text-fg motion-safe:animate-pop-in',
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
      className={cn('m-0 text-label text-fg-muted', className)}
      {...props}
    />
  );
}

export function ChatCardText({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="chat-card-text"
      className={cn('m-0 text-body break-words', className)}
      {...props}
    />
  );
}
