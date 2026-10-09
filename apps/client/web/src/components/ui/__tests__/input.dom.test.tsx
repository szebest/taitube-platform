import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { axeViolations } from '#app/__tests__/axe';
import { controlVariants } from '../field';
import { Input } from '../input';
import { variantNames } from '../variant-names';

const SIZES = variantNames(controlVariants.variants.size);

describe('apps/client/web: Input', () => {
  it.each(SIZES)(
    'is a %s text box typed into from the keyboard, with the focus ring',
    async (size) => {
      render(<Input aria-label="Title" size={size} />);

      await userEvent.tab();
      await userEvent.keyboard('Launch day');

      const input = screen.getByRole('textbox', { name: 'Title' });
      expect(input).toHaveFocus();
      expect(input).toHaveValue('Launch day');
      expect(input).toHaveClass('tw:focus-ring');
    }
  );

  it('lets its own props win over the field it sits in', () => {
    render(<Input aria-label="Title" id="own-id" />);

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAttribute('id', 'own-id');
  });

  it('passes axe', async () => {
    render(<Input aria-label="Title" placeholder="Add a title" />);

    expect(await axeViolations()).toEqual([]);
  });
});
