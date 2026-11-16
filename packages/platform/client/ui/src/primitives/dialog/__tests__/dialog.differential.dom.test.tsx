import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Dialog } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Button } from '../../button';

function renderShareDialog() {
  const trace: string[] = [];
  render(
    <Dialog.Root onOpenChange={(open) => trace.push(`open ${open}`)}>
      <Dialog.Trigger asChild>
        <Button>Share</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Share video</Dialog.Title>
          <Dialog.Description>Anyone with the link can watch it.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>Lisbon at night</Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button>Cancel</Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>,
    { wrapper: WithUiCopy }
  );
  return {
    user: userEvent.setup(),
    snapshot: () => ({ dom: document.body.innerHTML, trace: [...trace] }),
  };
}

describe('@vp/ui: Dialog, compiled and uncompiled', () => {
  it('opens and closes the same way in both builds', async () => {
    const { user, snapshot } = renderShareDialog();
    const steps = [snapshot()];

    await user.click(screen.getByRole('button', { name: 'Share' }));
    steps.push(snapshot());
    await user.keyboard('{Escape}');
    steps.push(snapshot());

    expect(steps).toMatchSnapshot();
  });
});
