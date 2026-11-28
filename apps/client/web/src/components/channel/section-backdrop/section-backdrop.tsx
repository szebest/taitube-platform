import { cn } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';

export interface SectionBackdropProps extends ComponentPropsWithRef<'div'> {
  /** The creator's own `page-image` variants: nothing is drawn from another origin. */
  image: { readonly w640: string; readonly w1280: string };
}

/** A creator's picture behind one section, dimmed so the text over it keeps its contrast. */
export function SectionBackdrop({ image, className, children, ...props }: SectionBackdropProps) {
  return (
    <div
      data-slot="section-backdrop"
      className={cn(
        'relative isolate overflow-hidden rounded-card bg-media p-inset-card text-on-media',
        className
      )}
      {...props}
    >
      <img
        data-slot="section-backdrop-image"
        src={image.w1280}
        srcSet={`${image.w640} 640w, ${image.w1280} 1280w`}
        sizes="100vw"
        alt=""
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
      <div
        data-slot="section-backdrop-scrim"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-scrim"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
