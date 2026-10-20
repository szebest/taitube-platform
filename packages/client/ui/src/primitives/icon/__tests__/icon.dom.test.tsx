import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { Icon, type IconProps } from '../icon';

function renderIcon(props: Partial<IconProps> = {}) {
  return render(<Icon {...{ name: 'search' as const, ...props }} />);
}

const iconIn = (container: HTMLElement) => container.querySelector('[data-slot="icon"]');

describe('@vp/ui: Icon', () => {
  it('hides a decorative icon from assistive technology', () => {
    const { container } = renderIcon();

    expect(iconIn(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('names an icon that carries the meaning alone as an image', () => {
    renderIcon({ name: 'verified', 'aria-label': 'Verified channel' });

    expect(screen.getByRole('img', { name: 'Verified channel' })).toBeInTheDocument();
  });

  it.each([
    { name: 'chevron-right', mirrored: true },
    { name: 'share', mirrored: true },
    { name: 'play', mirrored: false },
    { name: 'clock', mirrored: false },
  ] as const)('flips $name under right to left: $mirrored', ({ name, mirrored }) => {
    const { container } = renderIcon({ name });

    expect(iconIn(container)?.classList.contains('tw:rtl:-scale-x-100')).toBe(mirrored);
  });

  it.each(['more', 'more-h', 'grip', 'verified'] as const)(
    'draws %s filled, as the sprite does',
    (name) => {
      const { container } = renderIcon({ name });

      expect(iconIn(container)?.querySelector('circle[fill="currentColor"]')).not.toBeNull();
    }
  );

  it('passes axe', async () => {
    renderIcon();
    renderIcon({ name: 'verified', 'aria-label': 'Verified channel' });

    expect(await axeViolations()).toEqual([]);
  });
});
