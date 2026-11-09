import type { IconSize } from '@vp/design-tokens';
import type { LinkPlatform } from '@vp/domain';
import type { ComponentPropsWithRef } from 'react';
import { Icon } from '../icon';
import { PLATFORM_ICON_PATHS } from './platform-icon-paths.generated';
import { platformIconStyles } from './platform-icon.variants';

export interface PlatformIconProps extends Omit<ComponentPropsWithRef<'svg'>, 'name'> {
  platform: LinkPlatform;
  size?: IconSize;
}

/** The mark of a platform a channel links to, vendored as a path: no request is made to draw it. */
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
