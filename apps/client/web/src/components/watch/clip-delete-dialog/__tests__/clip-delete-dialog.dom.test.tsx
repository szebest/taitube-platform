import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { ClipDeleteDialog, type ClipDeleteDialogProps } from '..';

function renderDialog(props: Partial<ClipDeleteDialogProps> = {}) {
  render(
    <AppProviders>
      <ClipDeleteDialog
        triggerLabel="Delete clip"
        title="Delete this clip?"
        description="Its link stops working."
        confirmLabel="Delete"
        onConfirm={() => undefined}
        {...props}
      />
    </AppProviders>
  );
  return userEvent.setup();
}

describe('apps/client/web: ClipDeleteDialog', () => {
  it('asks before it deletes and hands the answer to onConfirm', async () => {
    const onConfirm = vi.fn();
    const user = renderDialog({ onConfirm });

    await user.click(screen.getByRole('button', { name: 'Delete clip' }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('has no axe violation open', async () => {
    renderDialog({ defaultOpen: true });
    await screen.findByRole('alertdialog', { name: 'Delete this clip?' });

    expect(await axeViolations()).toEqual([]);
  });
});
