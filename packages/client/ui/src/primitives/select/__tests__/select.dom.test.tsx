import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Select } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Field } from '../../field';

const renderVisibilitySelect = (onValueChange: (value: string) => void = () => undefined) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Field.Root>
        <Field.Label>Visibility</Field.Label>
        <Select.Root defaultValue="public" onValueChange={onValueChange}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              <Select.Label>Listed</Select.Label>
              <Select.Item value="public">Public</Select.Item>
            </Select.Group>
            <Select.Separator />
            <Select.Item value="unlisted">Unlisted</Select.Item>
            <Select.Item value="private">Private</Select.Item>
          </Select.Content>
        </Select.Root>
        <Field.Hint>Who can watch it</Field.Hint>
      </Field.Root>,
      { wrapper: WithUiCopy }
    ),
  };
};

describe('@vp/ui: Select', () => {
  it('is a combobox named and described by its field, showing the chosen value', () => {
    renderVisibilitySelect();

    const trigger = screen.getByRole('combobox', { name: 'Visibility' });
    expect(trigger).toHaveTextContent('Public');
    expect(trigger).toHaveAccessibleDescription('Who can watch it');
    expect(trigger).toHaveClass('tw:focus-ring');
  });

  it('opens from the keyboard, moves with the arrows and picks with Enter', async () => {
    const onValueChange = vi.fn();
    const { user } = renderVisibilitySelect(onValueChange);

    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('private');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Visibility' })).toHaveTextContent('Private');
  });

  it('passes axe open', async () => {
    const { user } = renderVisibilitySelect();
    await user.tab();
    await user.keyboard('{Enter}');

    expect(await axeViolations()).toEqual([]);
  });
});
