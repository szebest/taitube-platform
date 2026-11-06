import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { LiveLayout } from '..';
import type { LiveLayoutRootProps } from '../live-layout';

const renderLiveLayout = (props: Partial<LiveLayoutRootProps> = {}) =>
  render(
    <LiveLayout.Root {...props}>
      <LiveLayout.Stage>Stage</LiveLayout.Stage>
      <LiveLayout.Chat>
        <section aria-label="Live chat">Chat</section>
      </LiveLayout.Chat>
      <LiveLayout.Details>
        <h1>Lisbon trams at dusk</h1>
      </LiveLayout.Details>
    </LiveLayout.Root>
  );

describe('apps/client/web: LiveLayout', () => {
  it.each([
    { chat: 'docked', docked: true },
    { chat: 'overlay', docked: false },
  ] as const)('gives the chat its slot only when it is $chat', ({ chat, docked }) => {
    renderLiveLayout({ chat });

    expect(screen.getByText('Stage')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Live chat' }) !== null).toBe(docked);
  });

  it('passes axe', async () => {
    renderLiveLayout();

    expect(await axeViolations()).toEqual([]);
  });
});
