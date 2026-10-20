import type { IconSize, ToneOption } from '@vp/design-tokens';
import type { ComponentProps } from 'react';
import type { VariantProps } from 'tailwind-variants';
import { tv } from './class-names';
import { ICONS, type IconId, MIRROR_IN_RTL } from './icons/inventory';

const STROKE_WIDTH = 1.75;

export const iconVariants = tv({
  base: 'tw:shrink-0',
  variants: {
    size: {
      sm: 'tw:size-icon-sm',
      md: 'tw:size-icon-md',
      lg: 'tw:size-icon-lg',
    } satisfies Record<IconSize, string>,
    tone: {
      inherit: '',
      neutral: 'tw:text-fg-muted',
      accent: 'tw:text-accent-ink',
      danger: 'tw:text-danger-ink',
    } satisfies Record<'inherit' | Extract<ToneOption, 'neutral' | 'accent' | 'danger'>, string>,
    mirrored: { true: 'tw:rtl:-scale-x-100' },
  },
  defaultVariants: { size: 'md', tone: 'inherit' },
});

export type IconProps = Omit<ComponentProps<'svg'>, 'name'> &
  Omit<VariantProps<typeof iconVariants>, 'mirrored'> & {
    name: IconId;
  };

/** Decorative unless it has an `aria-label`, which makes it an image with that name. */
export function Icon({ name, size, tone, className, ...props }: IconProps) {
  const Glyph = ICONS[name];
  const labelled = props['aria-label'] !== undefined;

  return (
    <Glyph
      data-slot="icon"
      data-icon={name}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      focusable="false"
      strokeWidth={STROKE_WIDTH}
      className={iconVariants({ size, tone, mirrored: MIRROR_IN_RTL.has(name), className })}
      {...props}
    />
  );
}
