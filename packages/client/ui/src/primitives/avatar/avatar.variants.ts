import { tv } from '../../lib/class-names';
import type { AvatarShape, AvatarSize, AvatarTone } from './types';

export const avatarStyles = tv({
  slots: {
    root: 'tw:relative tw:inline-flex tw:shrink-0 tw:bg-tint-strong tw:font-sans tw:text-fg tw:select-none',
    image: 'tw:size-full tw:rounded-[inherit] tw:object-cover',
    fallback: 'tw:flex tw:size-full tw:items-center tw:justify-center tw:rounded-[inherit]',
  },
  variants: {
    size: {
      xs: { root: 'tw:size-avatar-xs', fallback: 'tw:text-[0px]' },
      sm: { root: 'tw:size-avatar-sm', fallback: 'tw:text-overline' },
      md: { root: 'tw:size-avatar-md', fallback: 'tw:text-label' },
      lg: { root: 'tw:size-avatar-lg', fallback: 'tw:text-title' },
      xl: { root: 'tw:size-avatar-xl', fallback: 'tw:text-headline' },
    } satisfies Record<AvatarSize, object>,
    shape: {
      circle: { root: 'tw:rounded-full' },
      square: { root: 'tw:rounded-sm' },
    } satisfies Record<AvatarShape, object>,
    tone: {
      neutral: {},
      live: {
        root: 'tw:shadow-[0_0_0_var(--border-focus)_var(--bg),0_0_0_calc(var(--border-focus)*2)_var(--live)]',
      },
    } satisfies Record<AvatarTone, object>,
  },
  defaultVariants: { size: 'md', shape: 'circle', tone: 'neutral' },
});
