import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { variantNames } from '#app/__tests__/variant-names';
import { Button } from '../button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  sheetVariants,
} from '../sheet';

const SIDES = variantNames(sheetVariants.variants.side);

function NavigationSheet({ side }: { side?: (typeof SIDES)[number] }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Menu</Button>
      </SheetTrigger>
      <SheetContent side={side} closeLabel="Close menu">
        <SheetHeader>
          <SheetTitle>Taitube</SheetTitle>
          <SheetDescription>Go to a page</SheetDescription>
        </SheetHeader>
        <a href="/trending">Trending</a>
      </SheetContent>
    </Sheet>
  );
}

describe('apps/web: Sheet', () => {
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

  it.each(THEMES)('passes axe open in the %s theme', async (theme) => {
    render(<NavigationSheet />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(await axeViolations(theme)).toEqual([]);
  });
});
