import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { axeViolations } from '#app/__tests__/axe';
import { Button } from '../button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../dialog';
import { SheetContent, sheetVariants } from '../sheet';
import { variantNames } from '../variant-names';

const SIDES = variantNames(sheetVariants.variants.side);

function NavigationSheet({ side }: { side?: (typeof SIDES)[number] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Menu</Button>
      </DialogTrigger>
      <SheetContent side={side} closeLabel="Close menu">
        <DialogHeader>
          <DialogTitle>Taitube</DialogTitle>
          <DialogDescription>Go to a page</DialogDescription>
        </DialogHeader>
        <a href="/trending">Trending</a>
      </SheetContent>
    </Dialog>
  );
}

describe('apps/client/web: Sheet', () => {
  it.each(SIDES)('slides in from the %s as a dialog named by its title', async (side) => {
    render(<NavigationSheet side={side} />);

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = screen.getByRole('dialog', { name: 'Taitube' });
    expect(sheet).toHaveClass(`tw:data-[state=open]:animate-slide-in-from-${side}`);
  });

  it('closes on Escape and hands focus back to the trigger', async () => {
    render(<NavigationSheet />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('passes axe open', async () => {
    render(<NavigationSheet />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(await axeViolations()).toEqual([]);
  });
});
