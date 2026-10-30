import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { LiveChatRoot } from '../live-chat';
import { LiveChatMessage, type LiveChatMessageProps } from '../live-chat-message';

const renderMessage = (props: Partial<LiveChatMessageProps> = {}) =>
  render(
    <AppProviders>
      <LiveChatRoot onSend={vi.fn()}>
        <ol>
          <LiveChatMessage author="ines" {...props}>
            The tram!
          </LiveChatMessage>
        </ol>
      </LiveChatRoot>
    </AppProviders>
  );

describe('apps/client/web: LiveChatMessage', () => {
  it.each([
    { role: 'creator' as const, badge: 'Creator' },
    { role: 'moderator' as const, badge: 'Moderator' },
  ])('badges a $role', ({ role, badge }) => {
    renderMessage({ role });

    expect(screen.getByText(badge)).toBeInTheDocument();
  });

  it.each([
    { state: 'sent' as const, text: 'The tram!' },
    { state: 'removed' as const, text: 'Message removed' },
  ])('shows "$text" when $state', ({ state, text }) => {
    renderMessage({ state });

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('offers retry for a failed message', async () => {
    const onRetry = vi.fn();
    renderMessage({ state: 'failed', onRetry });

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
