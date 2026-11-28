import { axeViolations } from '@kit/web-testing/dom';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { WatchPartyViewer } from '@vp/permissions';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { AppProviders } from '#app/__tests__/providers';
import { RoleEditor, type RoleEditorRole } from '..';

const MANAGER: WatchPartyViewer = {
  permissions: ['roles.manage', 'queue.add', 'chat.post'],
  topPosition: 50,
  isOwner: false,
  kind: 'user',
};

const role = (overrides: Partial<RoleEditorRole>): RoleEditorRole => ({
  id: 'r-custom',
  key: null,
  name: 'Queue keeper',
  colour: '#3366ff',
  position: 20,
  permissions: ['chat.post'],
  memberCount: 2,
  updatedAt: '2026-11-28T10:00:00.000Z',
  ...overrides,
});

function renderEditor(roles: RoleEditorRole[], voice = false) {
  const handlers = { onUpdate: vi.fn(), onDelete: vi.fn(), onCreate: vi.fn(), onApply: vi.fn() };
  const user = userEvent.setup();
  render(
    <AppProviders>
      <PartyPermissionsProvider userContext={null} viewer={MANAGER}>
        <RoleEditor.Root voice={voice} onUpdate={handlers.onUpdate} onDelete={handlers.onDelete}>
          <RoleEditor.List>
            {roles.map((entry) => (
              <RoleEditor.Role key={entry.id} role={entry} />
            ))}
          </RoleEditor.List>
          <RoleEditor.New onCreate={handlers.onCreate} />
          <RoleEditor.Preset onApply={handlers.onApply} />
        </RoleEditor.Root>
      </PartyPermissionsProvider>
    </AppProviders>
  );

  return { ...handlers, user };
}

describe('apps/client/web: RoleEditor', () => {
  it("saves a permission the editor holds, keeping the role's others", async () => {
    const { user, onUpdate } = renderEditor([role({})]);

    await user.click(screen.getByRole('checkbox', { name: /Add to the queue/ }));

    expect(onUpdate).toHaveBeenCalledWith('r-custom', {
      permissions: ['chat.post', 'queue.add'],
    });
  });

  it('disables a permission the editor lacks with its reason', () => {
    renderEditor([role({})]);

    const box = screen.getByRole('checkbox', { name: /Kick members/ });

    expect(box).toBeDisabled();
    expect(box.closest('label')).toHaveTextContent('You can only grant what you have');
  });

  it('renders a role at or above the editor read-only with its reason', () => {
    renderEditor([role({ id: 'r-cohost', key: 'cohost', name: 'Co-host', position: 80 })]);

    expect(screen.getByRole('group', { name: 'Co-host' })).toBeDisabled();
    expect(screen.getByText('You can only edit roles below your own position')).toBeVisible();
  });

  it('offers Guest nothing past its ceiling, and voice only when voice is on', () => {
    renderEditor([role({ id: 'r-guest', key: 'guest', name: 'Guest', position: 0 })], true);

    expect(
      within(screen.getByRole('group', { name: 'Guest' })).getAllByRole('checkbox')
    ).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: /Join voice/ })).toBeInTheDocument();
  });

  it('deletes a custom role but offers no delete on a built-in one', async () => {
    const { user, onDelete } = renderEditor([
      role({}),
      role({ id: 'r-dj', key: 'dj', name: 'DJ', position: 40 }),
    ]);

    await user.click(screen.getByRole('button', { name: 'Delete Queue keeper' }));

    expect(onDelete).toHaveBeenCalledWith('r-custom');
    expect(screen.queryByRole('button', { name: 'Delete DJ' })).not.toBeInTheDocument();
  });

  it('creates a role from a name and applies a preset after a confirm', async () => {
    const { user, onCreate, onApply } = renderEditor([]);

    await user.type(screen.getByRole('textbox', { name: 'Role name' }), 'Queue keeper');
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    await user.click(screen.getByRole('button', { name: 'Apply preset: Public' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onCreate).toHaveBeenCalledWith('Queue keeper');
    expect(onApply).toHaveBeenCalledWith('public');
  });

  it('passes axe', async () => {
    renderEditor([role({})]);

    expect(await axeViolations()).toEqual([]);
  });
});
