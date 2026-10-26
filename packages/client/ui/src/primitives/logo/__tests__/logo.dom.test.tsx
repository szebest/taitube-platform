import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Logo, type LogoProps } from '../logo';
import { logoStyles } from '../logo.variants';

const renderLogo = (props: LogoProps = {}) => render(<Logo {...props} />);

describe('@vp/ui: Logo', () => {
  it.each(variantNames(logoStyles.variants.variant))(
    'is one image named Taitube as a %s',
    (variant) => {
      renderLogo({ variant });

      expect(screen.getByRole('img', { name: 'Taitube' })).toHaveAttribute('data-slot', 'logo');
    }
  );

  it('steps aside for the home link that names it', () => {
    render(
      <a href="/" aria-label="Taitube home">
        <Logo aria-hidden="true" tone="accent" />
      </a>
    );

    expect(screen.getByRole('link', { name: 'Taitube home' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderLogo({ tone: 'accent', size: 'lg' });

    expect(await axeViolations()).toEqual([]);
  });
});
