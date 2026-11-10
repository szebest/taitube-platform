import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { WatchPartyViewer } from '@vp/permissions';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { PartyLobby, type PartyLobbyMember } from '..';

const HOST: WatchPartyViewer = {
  permissions: ['playback.control'],
  topPosition: 100,
  isOwner: true,
  kind: 'user',
};

const LISTENER: WatchPartyViewer = { ...HOST, permissions: ['chat.post'], isOwner: false };

const MEMBERS: PartyLobbyMember[] = [
  { key: 'user:1', name: 'Ana', avatarUrl: null, ready: true },
  { key: 'user:2', name: 'Bruno', avatarUrl: null, ready: false },
  { key: 'user:3', name: 'Carla', avatarUrl: null, ready: true },
];

function renderLobby(
  viewer: WatchPartyViewer,
  { ready = false, onToggleReady = vi.fn(), onStart = vi.fn() } = {}
) {
  render(
    <AppProviders>
      <PartyPermissionsProvider userContext={null} viewer={viewer}>
        <PartyLobby.Root>
          <PartyLobby.Status />
          <PartyLobby.ReadyCheck members={MEMBERS} guests={2} />
          <PartyLobby.Actions ready={ready} onToggleReady={onToggleReady} onStart={onStart} />
        </PartyLobby.Root>
      </PartyPermissionsProvider>
    </AppProviders>
  );
}

describe('apps/client/web: PartyLobby', () => {
  it('waits to start and counts who is ready, with guests as a count', () => {
    renderLobby(HOST);

    expect(screen.getByText('Waiting to start')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 ready · 2 guests')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Ready')).toHaveLength(2);
  });

  it.each([
    { ready: false, name: "I'm ready" },
    { ready: true, name: 'Not ready' },
  ])('offers "$name" while ready is $ready and reports the toggle', async ({ ready, name }) => {
    const onToggleReady = vi.fn();
    renderLobby(LISTENER, { ready, onToggleReady });

    await userEvent.click(screen.getByRole('button', { name }));

    expect(onToggleReady).toHaveBeenCalledOnce();
  });

  it('offers Start only to a viewer who may control playback', async () => {
    const onStart = vi.fn();
    renderLobby(HOST, { onStart });

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(onStart).toHaveBeenCalledOnce();
  });

  it('hides Start from everyone else', () => {
    renderLobby(LISTENER);

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it.each([
    { scenario: 'the countdown', ui: <PartyLobby.Countdown seconds={3} />, shown: 'Starting in 3' },
    {
      scenario: 'the scheduled start',
      ui: <PartyLobby.Status startsAt="20:00" />,
      shown: 'Starts 20:00',
    },
  ])('shows $scenario', ({ ui, shown }) => {
    render(<AppProviders>{ui}</AppProviders>);

    expect(screen.getByText(shown)).toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderLobby(HOST);

    expect(await axeViolations()).toEqual([]);
  });
});
