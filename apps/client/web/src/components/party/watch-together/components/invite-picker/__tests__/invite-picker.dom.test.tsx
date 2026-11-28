import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { InvitePicker, type InviteCandidate } from '../invite-picker';

const person = (overrides: Partial<InviteCandidate>): InviteCandidate => ({
  userId: '0190c3a0-5e1d-7000-8000-00000000d001',
  handle: 'ana',
  displayName: 'Ana Reis',
  avatarUrl: null,
  reason: 'co_watcher',
  inRoom: false,
  invited: false,
  ...overrides,
});

function renderPicker(candidates: InviteCandidate[], sending: string[] = []) {
  const onInvite = vi.fn();
  render(
    <InvitePicker
      query=""
      onQueryChange={() => undefined}
      candidates={candidates}
      sending={new Set(sending)}
      onInvite={onInvite}
    />,
    { wrapper: AppProviders }
  );
  return { onInvite, user: userEvent.setup() };
}

describe('apps/client/web: InvitePicker', () => {
  it('invites a person who is neither invited nor in the room', async () => {
    const { onInvite, user } = renderPicker([person({})]);

    await user.click(screen.getByRole('button', { name: 'Invite' }));

    expect(onInvite).toHaveBeenCalledWith('0190c3a0-5e1d-7000-8000-00000000d001');
  });

  it.each([
    { flags: { invited: true }, says: 'Invited' },
    { flags: { inRoom: true }, says: 'In the room' },
  ])('says $says instead of offering an invite', ({ flags, says }) => {
    renderPicker([person(flags)]);

    expect(screen.getByText(says)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
  });

  it('says there is nobody to invite when the list is empty', () => {
    renderPicker([]);

    expect(screen.getByText('Nobody to invite yet')).toBeInTheDocument();
  });
});
