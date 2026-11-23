import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { variantNames } from '../../../lib/variant-names';
import { Logo, type LogoProps } from '../logo';
import { logoStyles } from '../logo.variants';

const renderLogo = (props: Partial<LogoProps> = {}) => render(<Logo name="Acme" {...props} />);

describe('@kit/ui: Logo', () => {
  it.each(variantNames(logoStyles.variants.variant))(
    'is one image named Acme as a %s',
    (variant) => {
      renderLogo({ variant });

      expect(screen.getByRole('img', { name: 'Acme' })).toHaveAttribute('data-slot', 'logo');
    }
  );

  it('steps aside for the home link that names it', () => {
    render(
      <a href="/" aria-label="Acme home">
        <Logo name="Acme" aria-hidden="true" tone="accent" />
      </a>
    );

    expect(screen.getByRole('link', { name: 'Acme home' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderLogo({ tone: 'accent', size: 'lg' });

    expect(await axeViolations()).toEqual([]);
  });
});
