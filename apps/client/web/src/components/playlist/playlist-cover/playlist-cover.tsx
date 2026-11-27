import { cn, Icon } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';

const MAX_IMAGES = 4;

export interface PlaylistCoverProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  /** Distinct thumbnail URLs, already picked by the caller; the first four are drawn. */
  images: readonly string[];
}

/** A playlist's cover as a 16:9 frame: empty, one picture, two columns, or a 2 by 2 mosaic. */
export function PlaylistCover({ images, className, ...props }: PlaylistCoverProps) {
  const pictures = images.slice(0, MAX_IMAGES);
  const count = pictures.length;

  return (
    <div
      data-slot="playlist-cover"
      data-count={count}
      aria-hidden="true"
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-thumb bg-tint',
        count === 0 && 'flex items-center justify-center text-fg-muted',
        count > 1 && 'grid grid-cols-2 gap-0.5',
        count > 2 && 'grid-rows-2',
        className
      )}
      {...props}
    >
      {count === 0 && <Icon name="playlist" size="lg" />}
      {pictures.map((src, position) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className={cn(
            'size-full min-h-0 min-w-0 object-cover',
            count === 3 && position === 0 && 'row-span-2'
          )}
        />
      ))}
    </div>
  );
}
