import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Command } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Kbd } from '../../kbd';
import type { CommandRootProps } from '../command';

const renderPalette = (
  props: CommandRootProps = {},
  onSelect: (value: string) => void = () => undefined
) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Command.Root aria-label="Search and actions" {...props}>
        <Command.Input placeholder="Type a command" />
        <Command.List>
          <Command.Empty />
          <Command.Group heading="Actions">
            <Command.Item value="theme" onSelect={onSelect}>
              Switch theme
              <Command.Shortcut>
                <Kbd>T</Kbd>
              </Command.Shortcut>
            </Command.Item>
            <Command.Item value="queue" onSelect={onSelect}>
              Open the queue
            </Command.Item>
            <Command.Item value="locked" disabled>
              Locked
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Root>,
      { wrapper: WithUiCopy }
    ),
  };
};

describe('@vp/ui: Command', () => {
  it('filters its items as the viewer types and says so when nothing matches', async () => {
    const { user } = renderPalette();

    await user.type(screen.getByRole('combobox'), 'queue');
    expect(screen.getByRole('option', { name: 'Open the queue' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Switch theme/ })).not.toBeInTheDocument();

    await user.type(screen.getByRole('combobox'), 'zzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('moves with the arrows, skips a disabled item and runs the one chosen with Enter', async () => {
    const onSelect = vi.fn();
    const { user } = renderPalette({}, onSelect);

    await user.type(screen.getByRole('combobox'), '{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Open the queue' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('queue');
    expect(screen.getByRole('option', { name: 'Locked' })).toHaveAttribute('aria-disabled', 'true');
  });

  it.each([
    { variant: 'inline', rounded: 'tw:rounded-card' },
    { variant: 'palette', rounded: 'tw:rounded-sheet' },
  ] as const)('draws the $variant surface', ({ variant, rounded }) => {
    renderPalette({ variant });

    expect(screen.getByRole('combobox').closest('[data-slot="command"]')).toHaveClass(rounded);
  });

  it('passes axe', async () => {
    renderPalette();

    expect(await axeViolations()).toEqual([]);
  });
});
