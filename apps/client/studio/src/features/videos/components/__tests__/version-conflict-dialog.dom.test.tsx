import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { VersionConflictDialog } from '../version-conflict-dialog';

function renderDialog(open = true) {
  const handlers = { onOpenChange: vi.fn(), onReload: vi.fn(), onOverwrite: vi.fn() };
  render(<VersionConflictDialog open={open} {...handlers} />, { wrapper: AppProviders });
  return { user: userEvent.setup(), ...handlers };
}

describe('apps/client/studio: VersionConflictDialog', () => {
  it('names the conflict and offers reload or overwrite', async () => {
    const { user, onReload, onOverwrite } = renderDialog();

    expect(
      screen.getByRole('dialog', { name: 'This video changed while you were editing it' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await user.click(screen.getByRole('button', { name: 'Overwrite' }));

    expect(onReload).toHaveBeenCalledOnce();
    expect(onOverwrite).toHaveBeenCalledOnce();
  });

  it('is not on the page while closed', () => {
    renderDialog(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
