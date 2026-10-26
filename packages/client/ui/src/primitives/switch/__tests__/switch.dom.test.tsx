import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Switch } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Field } from '../../field';

const renderSwitch = () => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Field.Root orientation="horizontal">
        <Field.Label>Autoplay next</Field.Label>
        <Switch />
      </Field.Root>,
      { wrapper: WithUiCopy }
    ),
  };
};

describe('@vp/ui: Switch', () => {
  it.each(['[Space]', '{Enter}'])(
    'is a switch named by its field, flipped with %s',
    async (key) => {
      const { user } = renderSwitch();

      await user.tab();
      await user.keyboard(key);

      const control = screen.getByRole('switch', { name: 'Autoplay next' });
      expect(control).toBeChecked();
      expect(control).toHaveClass('tw:focus-ring');
    }
  );

  it('passes axe', async () => {
    renderSwitch();

    expect(await axeViolations()).toEqual([]);
  });
});
