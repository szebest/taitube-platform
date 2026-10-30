import { fireEvent, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';

import { CommandPaletteProvider, useCommandPaletteStore } from '../command-palette-store';

function OpenState() {
  const { open } = useCommandPaletteStore();

  return <output>{open ? 'open' : 'closed'}</output>;
}

function renderStore() {
  const user = userEvent.setup();
  render(
    <CommandPaletteProvider>
      <OpenState />
      <input aria-label="Title" />
      <div role="dialog" aria-label="Rename" tabIndex={-1} />
      <div role="menu" aria-label="More" tabIndex={-1} />
    </CommandPaletteProvider>
  );
  return user;
}

const focus = (name: string, role: string) => () => screen.getByRole(role, { name }).focus();

describe('apps/client/web: command palette store', () => {
  it.each([
    { label: '/ on the page', before: () => undefined, press: '/', shown: 'open' },
    { label: 'Ctrl K', before: () => undefined, press: '{Control>}k{/Control}', shown: 'open' },
    { label: 'Cmd K', before: () => undefined, press: '{Meta>}k{/Meta}', shown: 'open' },
    {
      label: 'Ctrl K in a field',
      before: focus('Title', 'textbox'),
      press: '{Control>}k{/Control}',
      shown: 'open',
    },
    {
      label: 'Ctrl K twice',
      before: () => undefined,
      press: '{Control>}kk{/Control}',
      shown: 'closed',
    },
    { label: '/ in a field', before: focus('Title', 'textbox'), press: '/', shown: 'closed' },
    { label: '/ in a dialog', before: focus('Rename', 'dialog'), press: '/', shown: 'closed' },
    { label: '/ in a menu', before: focus('More', 'menu'), press: '/', shown: 'closed' },
    {
      label: '/ with a modifier',
      before: () => undefined,
      press: '{Alt>}/{/Alt}',
      shown: 'closed',
    },
  ])('is $shown after $label', async ({ before, press, shown }) => {
    const user: UserEvent = renderStore();

    before();
    await user.keyboard(press);

    expect(screen.getByRole('status')).toHaveTextContent(shown);
  });

  it.each([
    {
      label: 'while composing text',
      press: () => fireEvent.keyDown(document.body, { key: '/', isComposing: true }),
    },
    {
      label: 'that something else handled',
      press: () => {
        document.body.addEventListener('keydown', (event) => event.preventDefault(), {
          once: true,
        });
        fireEvent.keyDown(document.body, { key: '/' });
      },
    },
  ])('stays closed on a / $label', ({ press }) => {
    renderStore();

    press();

    expect(screen.getByRole('status')).toHaveTextContent('closed');
  });
});
