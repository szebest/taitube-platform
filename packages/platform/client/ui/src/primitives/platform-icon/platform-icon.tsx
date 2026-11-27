import type { IconSize } from '@kit/design-tokens';
import type { ComponentPropsWithRef } from 'react';
import { PLATFORM_ICON_PATHS } from '../../icons/platform-icon-paths.generated';
import { Icon } from '../icon';
import { platformIconStyles } from './platform-icon.variants';

/** A brand whose mark is vendored, or `website`, any other link, drawn as a globe. */
export type PlatformIconName = keyof typeof PLATFORM_ICON_PATHS | 'website';

const isVendored = (name: string): name is keyof typeof PLATFORM_ICON_PATHS =>
  Object.hasOwn(PLATFORM_ICON_PATHS, name);

export const PLATFORM_ICON_NAMES: readonly PlatformIconName[] = [
  'website',
  ...Object.keys(PLATFORM_ICON_PATHS).filter(isVendored),
];

export interface PlatformIconProps extends Omit<ComponentPropsWithRef<'svg'>, 'name'> {
  platform: PlatformIconName;
  size?: IconSize;
}

/** The mark of the brand a link points to, vendored as a path: no request is made to draw it. */
export function PlatformIcon({ platform, size, className, ...props }: PlatformIconProps) {
  if (platform === 'website')
    return <Icon name="globe" size={size} className={className} {...props} />;

  const labelled = props['aria-label'] !== undefined;
  return (
    <svg
      data-slot="platform-icon"
      data-platform={platform}
      viewBox="0 0 24 24"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      focusable="false"
      className={platformIconStyles({ size, className })}
      {...props}
    >
      <path d={PLATFORM_ICON_PATHS[platform]} />
    </svg>
  );
}
