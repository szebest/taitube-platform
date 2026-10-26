import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Checkbox } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Field } from '../../field';
import type { CheckboxProps } from '../checkbox';

const renderCheckbox = (props: CheckboxProps = {}) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Field.Root orientation="horizontal">
        <Checkbox {...props} />
        <Field.Label>Select all</Field.Label>
      </Field.Root>,
      { wrapper: WithUiCopy }
    ),
  };
};

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
    { checked: true, state: 'true' },
    { checked: false, state: 'false' },
    { checked: 'indeterminate', state: 'mixed' },
  ] as const)(
    'reports checked=$checked to assistive technology as $state',
    ({ checked, state }) => {
      renderCheckbox({ checked });

      expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
        'aria-checked',
        state
      );
    }
  );

  it('passes axe', async () => {
    renderCheckbox({ checked: 'indeterminate' });

    expect(await axeViolations()).toEqual([]);
  });
});
