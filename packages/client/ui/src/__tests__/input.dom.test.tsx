import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { controlVariants } from '../field';
import { Input } from '../input';
import { variantNames } from '../variant-names';

const SIZES = variantNames(controlVariants.variants.size);

function renderInput(props: ComponentProps<typeof Input> = {}) {
  const user = userEvent.setup();
  return { user, ...render(<Input aria-label="Title" {...props} />) };
}

describe('@vp/ui: Input', () => {
  it.each(SIZES)(
    'is a %s text box typed into from the keyboard, with the focus ring',
    async (size) => {
      const { user } = renderInput({ size });

      await user.tab();
      await user.keyboard('Launch day');

      const input = screen.getByRole('textbox', { name: 'Title' });
      expect(input).toHaveFocus();
      expect(input).toHaveValue('Launch day');
      expect(input).toHaveClass('tw:focus-ring');
    }
  );

  it('lets its own props win over the field it sits in', () => {
    renderInput({ id: 'own-id' });

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAttribute('id', 'own-id');
  });

  it('passes axe', async () => {
    renderInput({ placeholder: 'Add a title' });

    expect(await axeViolations()).toEqual([]);
  });
});
