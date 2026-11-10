import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { Roster, type RosterMemberProps } from '..';

const renderRoster = (member: Partial<RosterMemberProps> = {}, guests = 2) =>
  render(
    <AppProviders>
      <Roster.Root>
        <Roster.Group label="Present" count={1}>
          <Roster.Member name="Ana" sync="in_sync" {...member} />
        </Roster.Group>
        <Roster.Guests count={guests} />
      </Roster.Root>
    </AppProviders>
  );

describe('apps/client/web: Roster', () => {
  it.each([
    { sync: 'lobby', label: 'In the lobby' },
    { sync: 'in_sync', label: 'In sync' },
    { sync: 'catching_up', label: 'Catching up' },
    { sync: 'buffering', label: 'Buffering' },
  ] as const)('names the $sync sync state', ({ sync, label }) => {
    renderRoster({ sync });

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    { member: { owner: true }, shown: 'Owner' },
    { member: { source: 'discord_chat' }, shown: 'via Discord' },
  ] as const)('marks $member on the row', ({ member, shown }) => {
    renderRoster(member);

    expect(within(screen.getByRole('listitem')).getByText(shown)).toBeInTheDocument();
  });

  it('ticks a member who is ready', () => {
    renderRoster({ ready: true });

    expect(screen.getByLabelText('Ready')).toBeInTheDocument();
  });

  it('shows the role badges and the menu on the row', () => {
    renderRoster({
      badges: <Roster.RoleBadge name="DJ" colour="#c9772f" />,
      menu: <button type="button">Options</button>,
    });

    expect(screen.getByText('DJ')).toHaveStyle({ color: '#c9772f' });
    expect(screen.getByRole('button', { name: 'Options' })).toBeInTheDocument();
  });

  it('counts guests and shows none when there are none', () => {
    const { rerender } = renderRoster({}, 2);
    expect(screen.getByText('2 guests')).toBeInTheDocument();

    rerender(
      <AppProviders>
        <Roster.Guests count={0} />
      </AppProviders>
    );

    expect(screen.queryByText(/guest/)).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderRoster();

    expect(await axeViolations()).toEqual([]);
  });
});
