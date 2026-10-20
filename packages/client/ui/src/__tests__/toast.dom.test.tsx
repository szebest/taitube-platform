import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { Button } from '../button';
import { createToaster, type Toaster, type ToastMessage, ToastProvider, useToast } from '../toast';
import { WithUiCopy } from './ui-copy-fixture';

function SaveButton({ message }: { message: ToastMessage }) {
  const toast = useToast();
  return <Button onClick={() => toast(message)}>Save</Button>;
}

function renderSave(
  message: ToastMessage,
  { toaster = createToaster(), provided = true }: { toaster?: Toaster; provided?: boolean } = {}
) {
  const user = userEvent.setup();
  const saveButton = <SaveButton message={message} />;
  return {
    user,
    ...render(
      provided ? <ToastProvider toaster={toaster}>{saveButton}</ToastProvider> : saveButton,
      { wrapper: WithUiCopy }
    ),
  };
}

describe('@vp/ui: Toast', () => {
  it.each(['neutral', 'success', 'danger'] as const)(
    'announces a %s toast with its title and text',
    async (variant) => {
      const { user } = renderSave({
        variant,
        title: 'Saved',
        description: 'Your changes are live',
      });

      await user.click(screen.getByRole('button', { name: 'Save' }));

      const toast = (await screen.findByText('Saved')).closest('[data-slot="toast"]');
      expect(toast).toHaveAttribute('data-state', 'open');
      expect(toast).toHaveTextContent('Your changes are live');
    }
  );

  it('runs its action, a retry for one', async () => {
    const onAction = vi.fn();
    const { user } = renderSave({
      variant: 'danger',
      title: 'Could not save',
      action: { label: 'Retry', onAction },
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it('closes from its named close button', async () => {
    const { user } = renderSave({ title: 'Saved' });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await user.click(await screen.findByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('shows what code outside React sends, before the provider mounts and after', async () => {
    const toaster = createToaster();
    toaster.show({ title: 'Signed out' });

    renderSave({ title: 'Saved' }, { toaster });
    act(() => toaster.show({ variant: 'danger', title: 'Could not save' }));

    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('Could not save')).toBeInTheDocument();
  });

  it('refuses useToast outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderSave({ title: 'Saved' }, { provided: false })).toThrow(
      'useToast must be used within ToastProvider'
    );
  });

  it('passes axe with a toast showing', async () => {
    const { user } = renderSave({
      title: 'Saved',
      action: { label: 'Undo', onAction: () => undefined },
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved');

    expect(await axeViolations()).toEqual([]);
  });
});
