import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { IconButton } from '../../icon-button';
import { Input, InputGroup } from '..';
import type { InputProps } from '../input';
import { inputStyles } from '../input.variants';

const renderInput = (props: InputProps = {}) => {
  const user = userEvent.setup();
  return { user, ...render(<Input aria-label="Title" {...props} />) };
};

describe('@vp/ui: Input', () => {
  it.each(variantNames(inputStyles.variants.size))(
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

  it('keeps its adornments in one box, the group drawing it', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <InputGroup.Root variant="soft">
        <InputGroup.Start>https://</InputGroup.Start>
        <Input aria-label="Address" />
        <InputGroup.End>
          <IconButton aria-label="Clear" onClick={onClear}>
            <svg aria-hidden="true" />
          </IconButton>
        </InputGroup.End>
      </InputGroup.Root>
    );

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Address' })).not.toHaveClass('tw:border-control');
  });

  it('passes axe', async () => {
    renderInput({ placeholder: 'Add a title' });

    expect(await axeViolations()).toEqual([]);
  });
});
