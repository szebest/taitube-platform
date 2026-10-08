import { fireEvent, render, screen } from '@testing-library/react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Avatar, avatarVariants } from '../avatar';
import { variantNames } from '../variant-names';

const SIZES = variantNames(avatarVariants.variants.size);

describe('apps/web: Avatar', () => {
  it.each(SIZES)('shows a %s picture, named after its owner', (size) => {
    render(<Avatar name="The Creator" src="/avatars/creator.png" size={size} />);

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
    render(<Avatar name={name} src={src} />);

    expect(screen.getByRole('img', { name: name.trim() })).toHaveTextContent(monogram);
  });

  it('falls back to the monogram when the picture fails to load, and tries a new one', () => {
    const { rerender } = render(<Avatar name="The Creator" src="/avatars/missing.png" />);

    fireEvent.error(screen.getByRole('img', { name: 'The Creator' }));
    expect(screen.getByRole('img', { name: 'The Creator' })).toHaveTextContent('T');

    rerender(<Avatar name="The Creator" src="/avatars/new.png" />);
    expect(screen.getByRole('img', { name: 'The Creator' })).toHaveAttribute(
      'src',
      '/avatars/new.png'
    );
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(
      <>
        <Avatar name="The Creator" src="/avatars/creator.png" />
        <Avatar name="Guest" />
      </>
    );

    expect(await axeViolations(theme)).toEqual([]);
  });
});
