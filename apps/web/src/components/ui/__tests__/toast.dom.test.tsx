import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Button } from '../button';
import { type ToastMessage, ToastProvider, useToast } from '../toast';

function SaveButton({ message }: { message: ToastMessage }) {
  const toast = useToast();
  return <Button onClick={() => toast(message)}>Save</Button>;
}

function renderSave(message: ToastMessage) {
  return render(
    <ToastProvider closeLabel="Dismiss">
      <SaveButton message={message} />
    </ToastProvider>
  );
}

describe('apps/web: Toast', () => {
  it.each(['neutral', 'success', 'danger'] as const)(
    'announces a %s toast with its title and text',
    async (variant) => {
      renderSave({ variant, title: 'Saved', description: 'Your changes are live' });

      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      const toast = (await screen.findByText('Saved')).closest('[data-slot="toast"]');
      expect(toast).toHaveAttribute('data-state', 'open');
      expect(toast).toHaveTextContent('Your changes are live');
    }
  );

  it('runs its action, a retry for one', async () => {
    const onAction = vi.fn();
    renderSave({
      variant: 'danger',
      title: 'Could not save',
      action: { label: 'Retry', onAction },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it('closes from its named close button', async () => {
    renderSave({ title: 'Saved' });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('refuses useToast outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<SaveButton message={{ title: 'Saved' }} />)).toThrow(
      'useToast must be used within ToastProvider'
    );
  });

  it.each(THEMES)('passes axe with a toast showing in the %s theme', async (theme) => {
    renderSave({ title: 'Saved', action: { label: 'Undo', onAction: () => undefined } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved');

    expect(await axeViolations(theme)).toEqual([]);
  });
});
