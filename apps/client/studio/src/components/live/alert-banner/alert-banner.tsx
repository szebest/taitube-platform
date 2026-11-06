import { cn, Icon } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** An announcement over video, slid in from below and still under reduced motion. */
export function AlertBannerRoot({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      role="status"
      data-slot="alert-banner"
      className={cn(
        'flex items-center gap-stack rounded-card bg-scrim p-inset-card text-fg motion-safe:animate-slide-in-from-bottom',
        className
      )}
      {...props}
    >
      <Icon name="heart" size="lg" className="shrink-0 text-accent-ink" />
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export function AlertBannerTitle({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="alert-banner-title"
      className={cn('m-0 text-headline', className)}
      {...props}
    />
  );
}

export function AlertBannerDetail({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="alert-banner-detail"
      className={cn('m-0 text-body text-fg-muted', className)}
      {...props}
    />
  );
}
