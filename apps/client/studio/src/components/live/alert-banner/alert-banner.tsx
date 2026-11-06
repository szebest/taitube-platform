import { cn, Icon } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** An announcement over video, slid in from below and still under reduced motion. */
export function AlertBannerRoot({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      role="status"
      data-slot="alert-banner"
      className={cn(
        'tw:flex tw:items-center tw:gap-stack tw:rounded-card tw:bg-scrim tw:p-inset-card tw:text-fg tw:motion-safe:animate-slide-in-from-bottom',
        className
      )}
      {...props}
    >
      <Icon name="heart" size="lg" className="tw:shrink-0 tw:text-accent-ink" />
      <div className="tw:flex tw:flex-col">{children}</div>
    </div>
  );
}

export function AlertBannerTitle({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="alert-banner-title"
      className={cn('tw:m-0 tw:text-headline', className)}
      {...props}
    />
  );
}

export function AlertBannerDetail({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="alert-banner-detail"
      className={cn('tw:m-0 tw:text-body tw:text-fg-muted', className)}
      {...props}
    />
  );
}
