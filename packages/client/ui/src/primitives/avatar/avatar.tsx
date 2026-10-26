import { Avatar as AvatarPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { AvatarContext, useAvatar } from './avatar.context';
import { avatarStyles } from './avatar.variants';
import type { AvatarShape, AvatarSize, AvatarTone } from './types';

export interface AvatarRootProps extends ComponentPropsWithRef<typeof AvatarPrimitive.Root> {
  size?: AvatarSize;
  shape?: AvatarShape;
  tone?: AvatarTone;
}

export function AvatarRoot({
  size = 'md',
  shape = 'circle',
  tone = 'neutral',
  className,
  ...props
}: AvatarRootProps) {
  const shared = useMemo(() => ({ size, shape, tone }), [size, shape, tone]);

  return (
    <AvatarContext value={shared}>
      <AvatarPrimitive.Root
        data-slot="avatar"
        className={avatarStyles(shared).root({ className })}
        {...props}
      />
    </AvatarContext>
  );
}

export interface AvatarImageProps extends ComponentPropsWithRef<typeof AvatarPrimitive.Image> {
  alt: string;
}

/** Shown once it has loaded; until then, and when it fails, the fallback stands in. */
export function AvatarImage({ className, ...props }: AvatarImageProps) {
  const shared = useAvatar('Image');

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={avatarStyles(shared).image({ className })}
      {...props}
    />
  );
}

export type AvatarFallbackProps = ComponentPropsWithRef<typeof AvatarPrimitive.Fallback>;

/** The monogram, an image named by its `aria-label`; `aria-hidden` when the name is printed beside it. */
export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  const shared = useAvatar('Fallback');

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      role="img"
      className={avatarStyles(shared).fallback({ className })}
      {...props}
    />
  );
}
