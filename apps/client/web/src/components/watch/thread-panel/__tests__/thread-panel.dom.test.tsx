import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { ThreadPanel } from '..';
import type { ThreadPanelRootProps } from '../thread-panel';

const renderPanel = (props: Partial<ThreadPanelRootProps> = {}) =>
  render(
    <AppProviders>
      <ThreadPanel.Root open onOpenChange={vi.fn()} onSeek={vi.fn()} {...props}>
        <ThreadPanel.Header>
          <ThreadPanel.Title>The twist at the tram</ThreadPanel.Title>
          <ThreadPanel.Anchor seconds={65} time="01:05" />
        </ThreadPanel.Header>
        <ThreadPanel.Body>Did anyone catch the second sign?</ThreadPanel.Body>
        <ThreadPanel.Replies>
          <p>Yes, the green one</p>
        </ThreadPanel.Replies>
        <ThreadPanel.Composer>
          <textarea aria-label="Reply" />
        </ThreadPanel.Composer>
      </ThreadPanel.Root>
    </AppProviders>
  );

describe('apps/client/web: ThreadPanel', () => {
  it('is a dialog named by the thread title with its text, replies and composer', () => {
    renderPanel();

    const panel = screen.getByRole('dialog', { name: 'The twist at the tram' });

    expect(panel).toHaveTextContent('Did anyone catch the second sign?');
    expect(panel).toHaveTextContent('Yes, the green one');
    expect(screen.getByRole('textbox', { name: 'Reply' })).toBeInTheDocument();
  });

  it('seeks to the moment from the chip, which names the time it goes to', async () => {
    const onSeek = vi.fn();
    renderPanel({ onSeek });

    await userEvent.click(screen.getByRole('button', { name: 'Go to 01:05' }));

    expect(onSeek).toHaveBeenCalledWith(65);
  });

  it('asks to close on Escape and from its close button', async () => {
    const onOpenChange = vi.fn();
    renderPanel({ onOpenChange });

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows nothing while closed', () => {
    renderPanel({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    renderPanel();

    expect(await axeViolations()).toEqual([]);
  });

  it('refuses a part outside its root', () => {
    expect(() =>
      render(
        <AppProviders>
          <ThreadPanel.Anchor seconds={1} time="00:01" />
        </AppProviders>
      )
    ).toThrow('ThreadPanel.Anchor must be inside ThreadPanel.Root');
  });
});
