import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { variantNames } from '../../../lib/variant-names';
import { Kbd, type KbdProps } from '../kbd';
import { kbdStyles } from '../kbd.variants';

const renderKbd = (props: KbdProps = {}) => render(<Kbd {...props}>Esc</Kbd>);

describe('@kit/ui: Kbd', () => {
  it.each(variantNames(kbdStyles.variants.variant))('prints its key as a %s keycap', (variant) => {
    renderKbd({ variant });

    expect(screen.getByText('Esc').tagName).toBe('KBD');
  });

  it('passes axe', async () => {
    renderKbd({ variant: 'soft', size: 'sm' });

    expect(await axeViolations()).toEqual([]);
  });
});
