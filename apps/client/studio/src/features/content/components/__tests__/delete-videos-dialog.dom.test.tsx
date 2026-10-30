import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { DeleteVideosDialog } from '../delete-videos-dialog';

function renderDialog(count: number) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <AppProviders>
      <DeleteVideosDialog open onOpenChange={onOpenChange} count={count} onConfirm={onConfirm} />
    </AppProviders>
  );
  return { onConfirm, onOpenChange, user: userEvent.setup() };
}

describe('apps/client/studio: DeleteVideosDialog', () => {
  it.each([
    { count: 1, title: 'Delete this video?' },
    { count: 3, title: 'Delete 3 videos?' },
  ])('asks about $count video(s) and warns it cannot be undone', ({ count, title }) => {
    renderDialog(count);

    expect(screen.getByRole('alertdialog', { name: title })).toHaveTextContent(
      'This cannot be undone.'
    );
  });

  it('confirms only when Delete is pressed', async () => {
    const { onConfirm, user } = renderDialog(2);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not close on an outside click, it is a decision', async () => {
    const { onOpenChange, user } = renderDialog(1);

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('passes axe', async () => {
    renderDialog(2);

    expect(await axeViolations()).toEqual([]);
  });
});
