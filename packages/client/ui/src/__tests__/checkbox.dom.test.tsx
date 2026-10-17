import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';

import { Checkbox } from '../checkbox';
import { Field } from '../field';

function renderCheckbox(props: ComponentProps<typeof Checkbox> = {}) {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Field label="Select all" orientation="horizontal">
        <Checkbox {...props} />
      </Field>
    ),
  };
}

describe('@vp/ui: Checkbox', () => {
  it('is a checkbox named by its field, toggled with Space', async () => {
    const { user } = renderCheckbox();

    await user.tab();
    await user.keyboard('[Space]');

    const checkbox = screen.getByRole('checkbox', { name: 'Select all' });
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveClass('tw:focus-ring');
  });

  it.each([
    { checked: true, state: true },
    { checked: false, state: false },
    { checked: 'indeterminate', state: 'mixed' },
  ] as const)('reports a checked state of  to assistive technology', ({ checked, state }) => {
    renderCheckbox({ checked });

    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'aria-checked',
      String(state)
    );
  });

  it('passes axe', async () => {
    renderCheckbox({ checked: 'indeterminate' });

    expect(await axeViolations()).toEqual([]);
  });
});
