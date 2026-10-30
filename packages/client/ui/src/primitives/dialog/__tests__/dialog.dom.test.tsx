import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Button } from '../../button';
import { Dialog } from '..';
import type { DialogContentProps } from '../dialog';

const renderShareDialog = (props: DialogContentProps = {}) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button>Share</Button>
        </Dialog.Trigger>
        <Dialog.Content {...props}>
          <Dialog.Header>
            <Dialog.Title>Share video</Dialog.Title>
            <Dialog.Description>Anyone with the link can watch it.</Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>Lisbon at night</Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button>Cancel</Button>
            </Dialog.Close>
            <Button variant="solid" tone="accent">
              Copy link
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>,
      { wrapper: WithUiCopy }
    ),
  };
};

const openFromKeyboard = async (props?: DialogContentProps) => {
  const rendered = renderShareDialog(props);
  await rendered.user.tab();
  await rendered.user.keyboard('{Enter}');
  return { ...rendered, dialog: screen.getByRole('dialog', { name: 'Share video' }) };
};

describe('@vp/ui: Dialog', () => {
  it('opens from its trigger as a dialog named by its title and described by its text', async () => {
    const { dialog } = await openFromKeyboard();

    expect(dialog).toHaveAccessibleDescription('Anyone with the link can watch it.');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps Tab inside the dialog while it is open', async () => {
    const { dialog, user } = await openFromKeyboard();

    for (const _ of [1, 2, 3, 4]) await user.tab();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it.each([
    {
      how: 'Escape',
      close: (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    },
    {
      how: 'the icon button',
      close: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Close' })),
    },
    {
      how: 'a close action',
      close: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Cancel' })),
    },
  ])('closes on $how and hands focus back to the trigger', async ({ close }) => {
    const { user } = await openFromKeyboard();

    await close(user);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toHaveFocus();
  });

  it.each([
    { side: 'inline-start', docked: 'tw:start-0' },
    { side: 'inline-end', docked: 'tw:end-0' },
  ] as const)('docks to the $side edge as a sheet', async ({ side, docked }) => {
    const { dialog } = await openFromKeyboard({ side });

    expect(dialog).toHaveClass(docked);
  });

  it('passes axe open', async () => {
    await openFromKeyboard();

    expect(await axeViolations()).toEqual([]);
  });
});
