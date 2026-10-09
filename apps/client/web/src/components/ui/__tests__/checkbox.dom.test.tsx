import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { axeViolations } from '#app/__tests__/axe';
import { Checkbox } from '../checkbox';
import { Field } from '../field';

function SelectRow({ checked }: { checked?: boolean | 'indeterminate' }) {
  return (
    <Field label="Select all" orientation="horizontal">
      <Checkbox checked={checked} />
    </Field>
  );
}

describe('apps/web: Checkbox', () => {
  it('is a checkbox named by its field, toggled with Space', async () => {
    render(
      <Field label="Autoplay" orientation="horizontal">
        <Checkbox />
      </Field>
    );

    await userEvent.tab();
    await userEvent.keyboard('[Space]');

    const checkbox = screen.getByRole('checkbox', { name: 'Autoplay' });
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveClass('tw:focus-ring');
  });

  it.each([
    { checked: true, state: true },
    { checked: false, state: false },
    { checked: 'indeterminate', state: 'mixed' },
  ] as const)('reports a checked state of  to assistive technology', ({ checked, state }) => {
    render(<SelectRow checked={checked} />);

    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'aria-checked',
      String(state)
    );
  });

  it('passes axe', async () => {
    render(<SelectRow checked="indeterminate" />);

    expect(await axeViolations()).toEqual([]);
  });
});
