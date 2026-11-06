import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { LiveChatRoot } from '../live-chat';
import { LiveChatMenu, LiveChatOpacity } from '../live-chat-menu';
import type { LiveChatLayout } from '../types';

const renderMenu = (layout: LiveChatLayout, container?: HTMLElement) =>
  render(
    <AppProviders>
      <LiveChatRoot layout={layout} onSend={vi.fn()}>
        <LiveChatMenu container={container}>
          <LiveChatOpacity />
        </LiveChatMenu>
      </LiveChatRoot>
    </AppProviders>
  );

describe('apps/client/web: LiveChatMenu', () => {
  it.each([
    { layout: 'docked' as const, shown: false },
    { layout: 'overlay' as const, shown: true },
  ])('shows the opacity slider $shown when $layout', async ({ layout, shown }) => {
    renderMenu(layout);

    await userEvent.click(screen.getByRole('button', { name: 'Chat options' }));

    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.queryByRole('slider') !== null).toBe(shown);
  });

  it('opens in the container it is handed, where a fullscreen player can show it', async () => {
    const fullscreen = document.body.appendChild(document.createElement('div'));
    renderMenu('overlay', fullscreen);

    await userEvent.click(screen.getByRole('button', { name: 'Chat options' }));

    expect(fullscreen).toContainElement(screen.getByRole('slider'));
    fullscreen.remove();
  });
});
