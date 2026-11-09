import { tv } from '../../lib/class-names';
import type { AvatarShape, AvatarSize, AvatarTone } from './types';

export const avatarStyles = tv({
  slots: {
    root: 'relative inline-flex shrink-0 bg-tint-strong font-sans text-fg',
    image: 'size-full rounded-[inherit] object-cover',
    fallback: 'flex size-full items-center justify-center rounded-[inherit]',
  },
  variants: {
    size: {
      xs: { root: 'size-avatar-xs', fallback: 'text-[0px]' },
      sm: { root: 'size-avatar-sm', fallback: 'text-overline' },
      md: { root: 'size-avatar-md', fallback: 'text-label' },
      lg: { root: 'size-avatar-lg', fallback: 'text-title' },
      xl: { root: 'size-avatar-xl', fallback: 'text-headline' },
    } satisfies Record<AvatarSize, object>,
    shape: {
      circle: { root: 'rounded-full' },
      square: { root: 'rounded-sm' },
    } satisfies Record<AvatarShape, object>,
    tone: {
      neutral: {},
      live: {
        root: 'shadow-[0_0_0_var(--border-focus)_var(--bg),0_0_0_calc(var(--border-focus)*2)_var(--live)]',
      },
    } satisfies Record<AvatarTone, object>,
  },
  defaultVariants: { size: 'md', shape: 'circle', tone: 'neutral' },
});
