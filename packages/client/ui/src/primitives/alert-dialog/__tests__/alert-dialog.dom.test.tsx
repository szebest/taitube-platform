import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Button } from '../../button';
import { AlertDialog } from '..';

const renderDeleteDialog = (onDelete: () => void = () => undefined) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <AlertDialog.Root>
        <AlertDialog.Trigger asChild>
          <Button>Delete</Button>
        </AlertDialog.Trigger>
        <AlertDialog.Content size="sm">
          <AlertDialog.Title>Delete this video?</AlertDialog.Title>
          <AlertDialog.Description>It leaves every playlist.</AlertDialog.Description>
          <AlertDialog.Footer>
            <AlertDialog.Cancel asChild>
              <Button>Keep</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="solid" tone="danger" onClick={onDelete}>
                Delete video
              </Button>
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    ),
  };
};

describe('@vp/ui: AlertDialog', () => {
  it('opens as an alert dialog named and described by its text', async () => {
    const { user } = renderDeleteDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      screen.getByRole('alertdialog', { name: 'Delete this video?' })
    ).toHaveAccessibleDescription('It leaves every playlist.');
  });

  it('ignores an outside click and closes on cancel', async () => {
    const { user } = renderDeleteDialog();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await user.click(document.querySelector('[data-slot="alert-dialog-overlay"]') as HTMLElement);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('runs its action', async () => {
    const onDelete = vi.fn();
    const { user } = renderDeleteDialog(onDelete);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await user.click(screen.getByRole('button', { name: 'Delete video' }));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('passes axe open', async () => {
    const { user } = renderDeleteDialog();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await axeViolations()).toEqual([]);
  });
});
