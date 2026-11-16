import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { ConfirmDialog } from '../confirm-dialog';

const renderConfirm = () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <AppProviders>
      <ConfirmDialog
        title="Revoke it?"
        description="Scripts stop."
        confirm="Revoke"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </AppProviders>
  );
  return { onConfirm, onClose, user: userEvent.setup() };
};

describe('apps/client/studio: ConfirmDialog', () => {
  it('confirms on its action and closes', async () => {
    const { user, onConfirm, onClose } = renderConfirm();

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape without confirming', async () => {
    const { user, onConfirm, onClose } = renderConfirm();

    await user.keyboard('{Escape}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
