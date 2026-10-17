import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Avatar, avatarVariants } from '../avatar';
import { variantNames } from '../variant-names';

const SIZES = variantNames(avatarVariants.variants.size);

const defaultAvatarProps = { name: 'The Creator', src: '/avatars/creator.png' };

type AvatarProps = Partial<ComponentProps<typeof Avatar>>;

function renderAvatar(props: AvatarProps = {}) {
  const result = render(<Avatar {...defaultAvatarProps} {...props} />);
  const rerenderAvatar = (next: AvatarProps) =>
    result.rerender(<Avatar {...defaultAvatarProps} {...next} />);
  return { ...result, rerenderAvatar };
}

describe('@vp/ui: Avatar', () => {
  it.each(SIZES)('shows a %s picture, named after its owner', (size) => {
    renderAvatar({ size });

    expect(screen.getByRole('img', { name: 'The Creator' })).toHaveAttribute(
      'src',
      '/avatars/creator.png'
    );
  });

  it.each([
    { name: 'the Creator', src: null, monogram: 'T' },
    { name: '  ana', src: undefined, monogram: 'A' },
    { name: 'Émile', src: '', monogram: 'É' },
  ])('falls back to the monogram $monogram without a picture', ({ name, src, monogram }) => {
    renderAvatar({ name, src });

    expect(screen.getByRole('img', { name: name.trim() })).toHaveTextContent(monogram);
  });

  it('falls back to the monogram when the picture fails to load, and tries a new one', () => {
    const { rerenderAvatar } = renderAvatar({ src: '/avatars/missing.png' });

    fireEvent.error(screen.getByRole('img', { name: 'The Creator' }));
    expect(screen.getByRole('img', { name: 'The Creator' })).toHaveTextContent('T');

    rerenderAvatar({ src: '/avatars/new.png' });
    expect(screen.getByRole('img', { name: 'The Creator' })).toHaveAttribute(
      'src',
      '/avatars/new.png'
    );
  });

  it('falls back to the monogram when the picture failed before the page went live', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);

    renderAvatar({ src: '/avatars/missing.png' });

    expect(screen.getByRole('img', { name: 'The Creator' })).toHaveTextContent('T');
  });

  it('passes axe', async () => {
    renderAvatar();
    renderAvatar({ name: 'Guest', src: undefined });

    expect(await axeViolations()).toEqual([]);
  });
});
