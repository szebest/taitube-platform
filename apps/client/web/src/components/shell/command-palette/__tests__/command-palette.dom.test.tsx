import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { useState } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { CommandPalette, CommandPaletteSkeleton } from '..';
import type { CommandPaletteVariant } from '../types';

interface Harness {
  query?: string;
  variant?: CommandPaletteVariant;
  items?: boolean;
}

function renderPalette({ query: initial = '', variant, items = true }: Harness = {}) {
  const onOpenChange = vi.fn();
  const onSubmitQuery = vi.fn();
  const onSelect = vi.fn();

  function Palette() {
    const [query, setQuery] = useState(initial);

    return (
      <CommandPalette.Root
        open
        onOpenChange={onOpenChange}
        query={query}
        onQueryChange={setQuery}
        onSubmitQuery={onSubmitQuery}
        variant={variant}
      >
        <CommandPalette.Input />
        <CommandPalette.Offline />
        <CommandPalette.List>
          {items && (
            <CommandPalette.Group heading="Videos">
              <CommandPalette.Item value="video:lisbon" onSelect={onSelect} meta="18:42">
                <mark>Lisbon</mark> at night
              </CommandPalette.Item>
            </CommandPalette.Group>
          )}
          <CommandPalette.Empty>Nothing matches</CommandPalette.Empty>
        </CommandPalette.List>
        <CommandPalette.Status>1 result</CommandPalette.Status>
        <CommandPalette.Footer />
      </CommandPalette.Root>
    );
  }

  const user = userEvent.setup();
  render(
    <AppProviders>
      <Palette />
    </AppProviders>
  );
  return { user, onOpenChange, onSubmitQuery, onSelect, field: screen.getByRole('combobox') };
}

describe('apps/client/web: CommandPalette', () => {
  it('opens as a named modal dialog with the field focused and the results grouped', () => {
    const { field } = renderPalette();

    expect(screen.getByRole('dialog', { name: 'Search Taitube' })).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('placeholder', 'Search videos, channels and actions');
    expect(screen.getByRole('group', { name: 'Videos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Lisbon at night/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it.each([
    { label: 'the active item', items: true, submitted: [], selected: 1 },
    {
      label: 'the raw words when nothing is active',
      items: false,
      submitted: ['lofi'],
      selected: 0,
    },
  ])('opens $label on Enter', async ({ items, submitted, selected }) => {
    const { user, field, onSubmitQuery, onSelect } = renderPalette({ items });

    await user.type(field, '  lofi {Enter}');

    expect(onSubmitQuery.mock.calls.map(([words]) => words)).toEqual(submitted);
    expect(onSelect).toHaveBeenCalledTimes(selected);
  });

  it('reaches "Search all results" with Tab, and offers it only once there are words', async () => {
    const { user, field, onSubmitQuery } = renderPalette();
    const searchAll = screen.getByRole('button', { name: 'Search all results' });

    expect(searchAll).toBeDisabled();

    await user.type(field, 'fado');
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');

    expect(searchAll).toHaveFocus();
    expect(onSubmitQuery).toHaveBeenCalledWith('fado');
  });

  it('clears the field and keeps the focus in it', async () => {
    const { user, field } = renderPalette({ query: 'fado' });

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it.each([
    {
      variant: 'dialog',
      close: (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    },
    {
      variant: 'sheet',
      close: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Cancel' })),
    },
  ] as const)('closes the $variant variant', async ({ variant, close }) => {
    const { user, onOpenChange } = renderPalette({ variant });

    await close(user);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('says what still works offline and reads the result count out politely', () => {
    renderPalette();

    expect(
      screen.getByText('You are offline. Actions and recent searches still work.')
    ).toBeInTheDocument();
    expect(screen.getByText('1 result')).toHaveAttribute('aria-live', 'polite');
  });

  it('passes axe, open and as a skeleton', async () => {
    renderPalette({ query: 'lisbon' });
    render(<CommandPaletteSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
