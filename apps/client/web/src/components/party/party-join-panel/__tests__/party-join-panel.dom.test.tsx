import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { PartyJoinPanel, type PartyJoinPanelProps } from '..';

function renderPanel(props: Partial<PartyJoinPanelProps> = {}) {
  const handlers = {
    onJoin: vi.fn(),
    onWatchAsGuest: vi.fn(),
    onDiscord: vi.fn(),
    onSignIn: vi.fn(),
    onWatchAlone: vi.fn(),
  };
  render(
    <AppProviders>
      <PartyJoinPanel
        state="yes"
        name="Movie night"
        ownerName="Ana"
        videoTitle="Big Buck Bunny"
        faces={[{ name: 'Ana', avatarUrl: null }]}
        total={3}
        {...handlers}
        {...props}
      />
    </AppProviders>
  );

  return handlers;
}

describe('apps/client/web: PartyJoinPanel', () => {
  it('shows the room, its host, its video and who is in it', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Movie night' })).toBeInTheDocument();
    expect(screen.getByText('Hosted by Ana · Big Buck Bunny')).toBeInTheDocument();
    expect(screen.getByText('3 here')).toBeInTheDocument();
  });

  it.each([
    {
      actions: ['guest', 'sign_in'],
      shown: ['Watch as guest', 'Sign in'],
      hidden: ['Join with Discord'],
    },
    {
      actions: ['guest', 'discord', 'sign_in'],
      shown: ['Watch as guest', 'Join with Discord', 'Sign in'],
      hidden: [],
    },
  ] as const)('offers $shown for a visitor', ({ actions, shown, hidden }) => {
    renderPanel({ actions });

    for (const name of shown) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    for (const name of hidden) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it.each([
    { name: 'Watch as guest', handler: 'onWatchAsGuest' },
    { name: 'Join with Discord', handler: 'onDiscord' },
    { name: 'Sign in', handler: 'onSignIn' },
  ] as const)('runs $handler from "$name"', async ({ name, handler }) => {
    const handlers = renderPanel({ actions: ['guest', 'discord', 'sign_in'] });

    await userEvent.click(screen.getByRole('button', { name }));

    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it('joins a signed-in viewer with one button', async () => {
    const { onJoin } = renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(onJoin).toHaveBeenCalledWith();
  });

  it('asks for the password and joins with it', async () => {
    const { onJoin } = renderPanel({ state: 'password' });

    await userEvent.type(screen.getByLabelText('Password'), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(onJoin).toHaveBeenCalledWith('hunter2');
  });

  it.each([
    { passwordError: 'invalid', shown: 'That password is not right', blocked: false },
    {
      passwordError: 'locked',
      shown: 'Too many tries. Try again in a few minutes.',
      blocked: true,
    },
  ] as const)(
    'says "$shown" for a $passwordError password',
    async ({ passwordError, shown, blocked }) => {
      renderPanel({ state: 'password', passwordError });
      await userEvent.type(screen.getByLabelText('Password'), 'x');

      expect(screen.getByText(shown)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Join' }).hasAttribute('disabled')).toBe(blocked);
    }
  );

  it('says the room is full, disables Join and offers to watch alone', async () => {
    const { onWatchAlone } = renderPanel({ state: 'full', full: { present: 10, capacity: 10 } });

    await userEvent.click(screen.getByRole('button', { name: 'Watch on your own' }));

    expect(screen.getByText('This party is full (10 of 10)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
    expect(onWatchAlone).toHaveBeenCalledOnce();
  });

  it.each([
    { state: 'banned', shown: 'You cannot join this party' },
    { state: 'closed', shown: 'This party ended' },
    { state: 'guests_off', shown: 'Guests are not welcome in this party. Sign in to join.' },
    { state: 'not_found', shown: 'This party does not exist' },
  ] as const)('says "$shown" when the state is $state', ({ state, shown }) => {
    renderPanel({ state });

    expect(screen.getByText(shown)).toBeInTheDocument();
  });

  it('shows no room details for a room that does not exist', () => {
    renderPanel({ state: 'not_found' });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderPanel({ state: 'password', actions: ['sign_in'] });

    expect(await axeViolations()).toEqual([]);
  });
});
