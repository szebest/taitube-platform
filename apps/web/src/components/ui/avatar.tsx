import { useState } from 'react';
import type { VariantProps } from 'tailwind-variants';
import { tv } from './class-names';

export const avatarVariants = tv({
  base: 'tw:relative tw:inline-flex tw:shrink-0 tw:overflow-hidden tw:rounded-full tw:bg-tint tw:font-sans tw:font-medium tw:text-fg tw:select-none',
  variants: {
    size: {
      sm: 'tw:size-6 tw:text-xs',
      md: 'tw:size-9 tw:text-sm',
      lg: 'tw:size-12 tw:text-lg',
      xl: 'tw:size-20 tw:text-2xl',
    },
  },
  defaultVariants: { size: 'md' },
});

export type AvatarProps = VariantProps<typeof avatarVariants> & {
  /** Names the picture for assistive technology and gives the monogram its letter. */
  name: string;
  src?: string | null;
  className?: string;
};

function monogram(name: string): string {
  const [first = ''] = Array.from(name.trim());
  return first.toUpperCase();
}

export function Avatar({ name, src, size, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <span data-slot="avatar" className={avatarVariants({ size, className })}>
      {src && src !== failedSrc ? (
        <img
          data-slot="avatar-image"
          src={src}
          alt={name}
          onError={() => setFailedSrc(src)}
          ref={(image) => {
            if (image?.complete && image.naturalWidth === 0) setFailedSrc(src);
          }}
          className="tw:size-full tw:object-cover"
        />
      ) : (
        <span
          data-slot="avatar-fallback"
          role="img"
          aria-label={name}
          className="tw:flex tw:size-full tw:items-center tw:justify-center"
        >
          {monogram(name)}
        </span>
      )}
    </span>
  );
}
