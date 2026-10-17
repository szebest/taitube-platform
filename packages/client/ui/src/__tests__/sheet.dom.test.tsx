import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { Button } from '../button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../dialog';
import { SheetContent, sheetVariants } from '../sheet';
import { variantNames } from '../variant-names';

const SIDES = variantNames(sheetVariants.variants.side);

function renderNavigationSheet(side?: (typeof SIDES)[number]) {
  const user = userEvent.setup();
  return {
    user,
    ...render(
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
    ),
  };
}

describe('@vp/ui: Sheet', () => {
  it.each(SIDES)('slides in from the %s as a dialog named by its title', async (side) => {
    const { user } = renderNavigationSheet(side);

    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = screen.getByRole('dialog', { name: 'Taitube' });
    expect(sheet).toHaveClass(`tw:data-[state=open]:animate-slide-in-from-${side}`);
  });

  it('closes on Escape and hands focus back to the trigger', async () => {
    const { user } = renderNavigationSheet();
    await user.tab();
    await user.keyboard('{Enter}');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('passes axe open', async () => {
    const { user } = renderNavigationSheet();
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    expect(await axeViolations()).toEqual([]);
  });
});
