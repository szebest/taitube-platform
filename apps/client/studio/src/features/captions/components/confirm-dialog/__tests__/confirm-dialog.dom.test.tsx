import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { ConfirmDialog } from '../confirm-dialog';

function renderDialog() {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const user = userEvent.setup();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete this track?"
      body="It goes."
      confirm="Delete track"
      onConfirm={onConfirm}
    />,
    { wrapper: AppProviders }
  );
  return { user, onConfirm, onOpenChange };
}

describe('apps/client/studio: ConfirmDialog', () => {
  it('asks the question and acts only on the confirmation', async () => {
    const { user, onConfirm } = renderDialog();

    expect(screen.getByText('It goes.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete track' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('closes without acting on cancel', async () => {
    const { user, onConfirm, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
