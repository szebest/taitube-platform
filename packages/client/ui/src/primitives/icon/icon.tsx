import type { IconSize } from '@vp/design-tokens';
import type { ComponentPropsWithRef } from 'react';
import { ICONS, type IconId, MIRROR_IN_RTL } from '../../icons/inventory';
import { iconStyles } from './icon.variants';
import type { IconTone } from './types';

const STROKE_WIDTH = 1.75;

export interface IconProps extends Omit<ComponentPropsWithRef<'svg'>, 'name'> {
  name: IconId;
  size?: IconSize;
  tone?: IconTone;
}

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
      className={iconStyles({ size, tone, mirrored: MIRROR_IN_RTL.has(name), className })}
      {...props}
    />
  );
}
