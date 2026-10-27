import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { rail, renderWorkspace } from './workspace.fixture';

describe('apps/client/studio: StudioWorkspace.Nav', () => {
  it.each(['large', 'medium'] as const)(
    'names each item by its label and marks the active one on a %s screen',
    (width) => {
      renderWorkspace(width);

      expect(within(rail()).getByRole('link', { name: 'Videos' })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(within(rail()).getByRole('link', { name: 'Analytics' })).not.toHaveAttribute(
        'aria-current'
      );
    }
  );

  it('moves between the items with the arrow keys, wrapping at the ends', async () => {
    renderWorkspace();
    within(rail()).getByRole('link', { name: 'Videos' }).focus();

    await userEvent.keyboard('{ArrowDown}');

    expect(within(rail()).getByRole('link', { name: 'Analytics' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');

    expect(within(rail()).getByRole('link', { name: 'Videos' })).toHaveFocus();
  });

  it('closes the drawer once a link in it is followed', async () => {
    renderWorkspace('compact');
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('link', { name: 'Videos' })
    );

    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('passes axe collapsed', async () => {
    renderWorkspace('medium');

    expect(await axeViolations()).toEqual([]);
  });
});
