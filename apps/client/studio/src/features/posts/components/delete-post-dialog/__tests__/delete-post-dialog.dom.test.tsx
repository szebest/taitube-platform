import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { DeletePostDialog } from '../delete-post-dialog';

function renderDialog() {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<DeletePostDialog onConfirm={onConfirm} onClose={onClose} />, { wrapper: AppProviders });
  return { onConfirm, onClose, user: userEvent.setup() };
}

describe('apps/client/studio: DeletePostDialog', () => {
  it('says what goes with the post and acts only on the confirmation', async () => {
    const { user, onConfirm, onClose } = renderDialog();

    expect(screen.getByText(/replies, likes and stats go with it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete post' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    {
      how: 'Cancel',
      act: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Cancel' })),
    },
    { how: 'Escape', act: (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}') },
  ])('closes on $how without deleting', async ({ act }) => {
    const { user, onConfirm, onClose } = renderDialog();

    await act(user);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
