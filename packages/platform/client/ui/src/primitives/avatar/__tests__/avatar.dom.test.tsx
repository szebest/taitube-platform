import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { AvatarFallback, AvatarImage, AvatarRoot, type AvatarRootProps } from '../avatar';
import { avatarStyles } from '../avatar.variants';

const renderAvatar = (props: AvatarRootProps = {}) =>
  render(
    <AvatarRoot {...props}>
      <AvatarImage src="/avatars/marta.png" alt="Marta Reis" />
      <AvatarFallback aria-label="Marta Reis">M</AvatarFallback>
    </AvatarRoot>
  );

describe('@vp/ui: Avatar', () => {
  it.each(variantNames(avatarStyles.variants.size))(
    'stands its monogram in for a %s picture that has not loaded, named after its owner',
    (size) => {
      renderAvatar({ size });

      expect(screen.getByRole('img', { name: 'Marta Reis' })).toHaveTextContent('M');
    }
  );

  it('draws the live ring for a channel that is live', () => {
    const { container } = renderAvatar({ tone: 'live' });

    expect(container.querySelector('[data-slot="avatar"]')?.className).toContain('var(--live)');
  });

  it('names the part used outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<AvatarFallback>M</AvatarFallback>)).toThrow(
      'Avatar.Fallback must be inside Avatar.Root'
    );
  });

  it('passes axe', async () => {
    renderAvatar({ shape: 'square', tone: 'live' });

    expect(await axeViolations()).toEqual([]);
  });
});
