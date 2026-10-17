import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { Field } from '../field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../select';

function renderVisibilitySelect(onValueChange: (value: string) => void = () => undefined) {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Field label="Visibility" description="Who can watch it">
        <Select defaultValue="public" onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Listed</SelectLabel>
              <SelectItem value="public">Public</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectItem value="unlisted">Unlisted</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    ),
  };
}

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
