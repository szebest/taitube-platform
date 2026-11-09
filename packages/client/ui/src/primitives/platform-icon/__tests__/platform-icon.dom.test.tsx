import { render, screen } from '@testing-library/react';
import { LINK_PLATFORMS } from '@vp/domain';
import { axeViolations } from '@vp/web-testing/dom';
import PLATFORM_ICON_PATHS from '../../../icons/platform-icon-paths.generated.json';
import { PlatformIcon, type PlatformIconProps } from '../platform-icon';

const renderIcon = (props: Partial<PlatformIconProps> = {}) =>
  render(<PlatformIcon platform="github" {...props} />);

describe('PlatformIcon', () => {
  it.each(LINK_PLATFORMS)('draws %s from the repo and from nothing else', (platform) => {
    const { container } = renderIcon({ platform });

    const drawn =
      platform === 'website'
        ? container.querySelector('svg path')
        : container.querySelector('path');
    expect(drawn).not.toBeNull();
    expect(container.querySelector('img, image, use, [href]')).toBeNull();
  });

  it.each(LINK_PLATFORMS.filter((platform) => platform !== 'website'))(
    'carries the vendored path of %s',
    (platform) => {
      const { container } = renderIcon({ platform });

      expect(container.querySelector('path')?.getAttribute('d')).toBe(
        PLATFORM_ICON_PATHS[platform as keyof typeof PLATFORM_ICON_PATHS]
      );
    }
  );

  it('is decorative unless it is labelled', () => {
    const { container, rerender } = renderIcon();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    rerender(<PlatformIcon platform="github" aria-label="GitHub" />);
    expect(screen.getByRole('img', { name: 'GitHub' })).toBeInTheDocument();
  });

  it('sizes from the icon scale', () => {
    const { container } = renderIcon({ size: 'lg' });

    expect(container.querySelector('svg')).toHaveClass('size-icon-lg');
  });

  it('passes axe', async () => {
    renderIcon({ 'aria-label': 'GitHub' });

    expect(await axeViolations()).toEqual([]);
  });
});
