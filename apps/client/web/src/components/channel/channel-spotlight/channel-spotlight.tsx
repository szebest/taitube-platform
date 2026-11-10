import { Skeleton } from '@vp/ui';
import { type ComponentPropsWithRef, useId } from 'react';
import { ChannelSpotlightContext, useChannelSpotlight } from './channel-spotlight.context';
import { channelSpotlightStyles } from './channel-spotlight.variants';
import type { ChannelSpotlightSource } from './types';

export interface ChannelSpotlightRootProps extends ComponentPropsWithRef<'section'> {
  /** Which slot the video came from: the channel's trailer, or the video it keeps for subscribers who come back. */
  source: ChannelSpotlightSource;
}

/**
 * The video a channel page opens with. Its child is a `VideoCard.Root variant="spotlight"`, with
 * this component's `Kicker` and `Actions` composed in among the card's own parts.
 */
export function ChannelSpotlightRoot({
  source,
  className,
  children,
  ...props
}: ChannelSpotlightRootProps) {
  const kickerId = useId();

  return (
    <ChannelSpotlightContext value={{ source, kickerId }}>
      <section
        data-slot="channel-spotlight"
        data-source={source}
        aria-labelledby={kickerId}
        className={channelSpotlightStyles({ source }).root({ className })}
        {...props}
      >
        {children}
      </section>
    </ChannelSpotlightContext>
  );
}

/** The label that names the section: "Channel trailer" or "Welcome back", a finished string. */
export function ChannelSpotlightKicker({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const { source, kickerId } = useChannelSpotlight('Kicker');

  return (
    <p
      data-slot="channel-spotlight-kicker"
      id={kickerId}
      className={channelSpotlightStyles({ source }).kicker({ className })}
      {...props}
    />
  );
}

/** Watch and the other actions, above the card's stretched title link. */
export function ChannelSpotlightActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { source } = useChannelSpotlight('Actions');

  return (
    <div
      data-slot="channel-spotlight-actions"
      className={channelSpotlightStyles({ source }).actions({ className })}
      {...props}
    />
  );
}

const bar = (className: string) => <Skeleton shape="text" radius="xs" className={className} />;

export function ChannelSpotlightSkeleton() {
  return (
    <div
      data-slot="channel-spotlight-skeleton"
      aria-hidden="true"
      className="flex flex-col gap-section rounded-card bg-surface p-inset-card expanded:min-h-[16rem] expanded:flex-row"
    >
      <Skeleton
        radius="thumb"
        className="aspect-video w-full shrink-0 medium:max-w-[30rem] expanded:w-[28.75rem]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-inline">
        {bar('w-[7rem] text-overline')}
        {bar('w-full text-headline')}
        {bar('w-[64%] text-headline')}
        {bar('w-[10rem] text-caption')}
        <Skeleton radius="control" className="h-control-md w-[6rem]" />
      </div>
    </div>
  );
}
