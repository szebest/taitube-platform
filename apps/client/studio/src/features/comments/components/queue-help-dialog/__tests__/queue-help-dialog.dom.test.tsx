import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { QueueHelpDialog } from '../queue-help-dialog';

const renderHelp = (open = true) => {
  const onOpenChange = vi.fn();
  render(<QueueHelpDialog open={open} onOpenChange={onOpenChange} />, { wrapper: AppProviders });
  return onOpenChange;
};

describe('apps/client/studio: QueueHelpDialog', () => {
  it('lists every key with what it does', () => {
    renderHelp();

    const keys = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }));

    expect(keys.getAllByRole('term').map((key) => key.textContent)).toEqual([
      'j',
      'k',
      'a',
      'r',
      'h',
      'b',
      'v',
      'x',
      '?',
    ]);
    expect(keys.getByText('Switch the next action between silent and visible')).toBeInTheDocument();
  });

  it('asks to close on Escape', async () => {
    const onOpenChange = renderHelp();

    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('draws nothing while closed', () => {
    renderHelp(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
