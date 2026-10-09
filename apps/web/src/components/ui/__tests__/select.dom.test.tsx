import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { axeViolations } from '#app/__tests__/axe';
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

function VisibilitySelect({
  onValueChange = () => undefined,
}: { onValueChange?: (value: string) => void }) {
  return (
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
  );
}

describe('apps/web: Select', () => {
  it('is a combobox named and described by its field, showing the chosen value', () => {
    render(<VisibilitySelect />);

    const trigger = screen.getByRole('combobox', { name: 'Visibility' });
    expect(trigger).toHaveTextContent('Public');
    expect(trigger).toHaveAccessibleDescription('Who can watch it');
    expect(trigger).toHaveClass('tw:focus-ring');
  });

  it('opens from the keyboard, moves with the arrows and picks with Enter', async () => {
    const onValueChange = vi.fn();
    render(<VisibilitySelect onValueChange={onValueChange} />);

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('private');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Visibility' })).toHaveTextContent('Private');
  });

  it('passes axe open', async () => {
    render(<VisibilitySelect />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    expect(await axeViolations()).toEqual([]);
  });
});
