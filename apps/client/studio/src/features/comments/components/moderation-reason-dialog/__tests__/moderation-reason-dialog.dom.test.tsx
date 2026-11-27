import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import {
  ModerationReasonDialog,
  type ModerationReasonDialogProps,
} from '../moderation-reason-dialog';

const renderDialog = ({
  action = 'remove',
  ...props
}: Partial<ModerationReasonDialogProps> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ModerationReasonDialog action={action} onConfirm={onConfirm} onCancel={onCancel} {...props} />,
    { wrapper: AppProviders }
  );
  return { onConfirm, onCancel };
};

describe('apps/client/studio: ModerationReasonDialog', () => {
  it('stays closed without an action', () => {
    renderDialog({ action: null });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    { keys: '{Enter}', reason: 'spam' },
    { keys: '2{Enter}', reason: 'harassment' },
    { keys: '5{Enter}', reason: 'other' },
    { keys: '6{Enter}', reason: 'off_topic' },
    { keys: '7{Enter}', reason: 'spam' },
  ])('confirms $reason after $keys', async ({ keys, reason }) => {
    const { onConfirm } = renderDialog();
    screen.getByRole('radio', { name: /Spam/ }).focus();

    await userEvent.keyboard(keys);

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ reason }));
  });

  it('does not take digits or Enter as shortcuts while a note is being typed', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Note to the author' }),
      '3 times{Enter}'
    );

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Spam/ })).toBeChecked();
  });

  it('sends the note and, for a ban, the duration', async () => {
    const { onConfirm } = renderDialog({ action: 'ban' });

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Note to the author' }),
      'Last warning'
    );
    await userEvent.click(screen.getByRole('combobox', { name: 'Ban for' }));
    await userEvent.click(await screen.findByRole('option', { name: '30 days' }));
    await userEvent.click(screen.getByRole('button', { name: /Ban/ }));

    expect(onConfirm).toHaveBeenCalledWith({
      reason: 'spam',
      note: 'Last warning',
      duration: '30d',
    });
  });

  it('asks for a duration on a ban only', () => {
    renderDialog({ action: 'hide' });

    expect(screen.queryByRole('combobox', { name: 'Ban for' })).not.toBeInTheDocument();
  });

  it('cancels', async () => {
    const { onCancel } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
