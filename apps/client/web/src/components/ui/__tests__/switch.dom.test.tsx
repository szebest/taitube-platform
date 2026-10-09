import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { axeViolations } from '#app/__tests__/axe';
import { Field } from '../field';
import { Switch } from '../switch';

function AutoplaySwitch() {
  return (
    <Field label="Autoplay next" orientation="horizontal">
      <Switch />
    </Field>
  );
}

describe('apps/client/web: Switch', () => {
  it.each(['[Space]', '{Enter}'])(
    'is a switch named by its field, flipped with %s',
    async (key) => {
      render(<AutoplaySwitch />);

      await userEvent.tab();
      await userEvent.keyboard(key);

      const control = screen.getByRole('switch', { name: 'Autoplay next' });
      expect(control).toBeChecked();
      expect(control).toHaveClass('tw:focus-ring');
    }
  );

  it('passes axe', async () => {
    render(<AutoplaySwitch />);

    expect(await axeViolations()).toEqual([]);
  });
});
