import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Button } from '../button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog';

function ShareDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Share</Button>
      </DialogTrigger>
      <DialogContent closeLabel="Close">
        <DialogHeader>
          <DialogTitle>Share video</DialogTitle>
          <DialogDescription>Anyone with the link can watch it.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button variant="primary">Copy link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function openFromKeyboard() {
  render(<ShareDialog />);
  await userEvent.tab();
  await userEvent.keyboard('{Enter}');
  return screen.getByRole('dialog', { name: 'Share video' });
}

describe('apps/web: Dialog', () => {
  it('opens from its trigger as a dialog named by its title and described by its text', async () => {
    const dialog = await openFromKeyboard();

    expect(dialog).toHaveAccessibleDescription('Anyone with the link can watch it.');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps Tab inside the dialog while it is open', async () => {
    const dialog = await openFromKeyboard();

    for (const _ of [1, 2, 3, 4]) await userEvent.tab();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it.each([
    { how: 'Escape', close: () => userEvent.keyboard('{Escape}') },
    {
      how: 'the icon button',
      close: () => userEvent.click(screen.getByRole('button', { name: 'Close' })),
    },
    {
      how: 'a close action',
      close: () => userEvent.click(screen.getByRole('button', { name: 'Cancel' })),
    },
  ])('closes on $how and hands focus back to the trigger', async ({ close }) => {
    await openFromKeyboard();

    await close();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toHaveFocus();
  });

  it('animates in and out on its open state, and not at all for reduced motion', async () => {
    const dialog = await openFromKeyboard();

    expect(dialog).toHaveAttribute('data-state', 'open');
    expect(dialog).toHaveClass(
      'tw:data-[state=open]:animate-pop-in',
      'tw:data-[state=closed]:animate-pop-out',
      'tw:motion-reduce:animate-none'
    );
  });

  it.each(THEMES)('passes axe open in the %s theme', async (theme) => {
    await openFromKeyboard();

    expect(await axeViolations(theme)).toEqual([]);
  });
});
