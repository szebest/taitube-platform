import { screen, within } from '@testing-library/react';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { EDITOR_ID, member, roleChanged } from '#app/features/team/__tests__/team-api.fixture';

const id = (n: number) => `0190c3a0-5e1d-7000-8000-0000000ee00${n}`;

describe('apps/client/studio: AuditPanel', () => {
  it('lists the rows newest first, the actor being the member who acted', async () => {
    await renderTeam('/team?tab=audit', {
      state: { auditPages: [[roleChanged(id(1)), roleChanged(id(2))]] },
    });

    const list = await screen.findByRole('list', { name: 'Audit log entries' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByText('The Creator')).toHaveLength(2);
    expect(within(list).getAllByText('from Editor to Manager')).toHaveLength(2);
  });

  it('asks for the next keyset page on Load more, and not once the last one is in', async () => {
    const { user, requests } = await renderTeam('/team?tab=audit', {
      state: { auditPages: [[roleChanged(id(1))], [roleChanged(id(2))]] },
    });

    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    await vi.waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Audit log entries' })).getAllByRole('listitem')
      ).toHaveLength(2)
    );
    expect(requests.audits.map(({ cursor }) => cursor)).toEqual([null, '1']);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('narrows the log to one action and says so in the address', async () => {
    const { user, router, requests } = await renderTeam('/team?tab=audit', {
      state: { auditPages: [[roleChanged(id(1))]] },
    });
    await screen.findByRole('list', { name: 'Audit log entries' });

    await user.click(screen.getByRole('combobox', { name: 'What' }));
    await user.click(await screen.findByRole('option', { name: 'Removed a member' }));

    await vi.waitFor(() => expect(requests.audits.at(-1)?.action).toBe('member.removed'));
    expect(router.state.location.search).toMatchObject({ tab: 'audit', action: 'member.removed' });
  });

  it('narrows the log to one actor from the team', async () => {
    const { user, requests } = await renderTeam('/team?tab=audit', {
      state: {
        members: [member(EDITOR_ID, 'editor', 'Eddie')],
        auditPages: [[roleChanged(id(1))]],
      },
    });
    await screen.findByRole('list', { name: 'Audit log entries' });

    await user.click(screen.getByRole('combobox', { name: 'Who' }));
    await user.click(await screen.findByRole('option', { name: 'Eddie' }));

    await vi.waitFor(() => expect(requests.audits.at(-1)?.actor).toBe(EDITOR_ID));
  });

  it('says there is nothing to show for a log without rows', async () => {
    await renderTeam('/team?tab=audit');

    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
  });
});
