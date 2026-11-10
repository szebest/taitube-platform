import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { WatchPartyViewer } from '@vp/permissions';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { MemberMenu, type MemberMenuProps } from '..';

const MODERATOR: WatchPartyViewer = {
  permissions: ['chat.moderate', 'voice.moderate', 'members.kick', 'members.ban', 'roles.assign'],
  topPosition: 50,
  isOwner: false,
  kind: 'user',
};

const ONLY_CHATTING: WatchPartyViewer = {
  permissions: ['chat.post'],
  topPosition: 1,
  isOwner: false,
  kind: 'user',
};

const ROLES = [
  { id: 'r-dj', name: 'DJ', key: 'dj', position: 20, assigned: false },
  { id: 'r-cohost', name: 'Co-host', key: 'cohost', position: 80, assigned: false },
];

function renderMenu(viewer: WatchPartyViewer, props: Partial<MemberMenuProps> = {}) {
  const handlers = {
    onToggleRole: vi.fn(),
    onMute: vi.fn(),
    onKick: vi.fn(),
    onBan: vi.fn(),
    onTransfer: vi.fn(),
  };
  const user = userEvent.setup();
  render(
    <AppProviders>
      <PartyPermissionsProvider userContext={null} viewer={viewer}>
        <MemberMenu
          name="Bruno"
          member={{ topPosition: 10, isOwner: false, kind: 'user' }}
          roles={ROLES}
          {...handlers}
          {...props}
        />
      </PartyPermissionsProvider>
    </AppProviders>
  );
  const open = () => user.click(screen.getByRole('button', { name: 'Options for Bruno' }));

  return { ...handlers, user, open };
}

describe('apps/client/web: MemberMenu', () => {
  it('offers the moderation the viewer holds on a member below them', async () => {
    const { open } = renderMenu(MODERATOR);

    await open();

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Roles',
      'Mute in chat',
      'Kick',
      'Ban',
    ]);
  });

  it('draws no menu for a viewer who may do nothing to the member', () => {
    renderMenu(ONLY_CHATTING);

    expect(screen.queryByRole('button', { name: 'Options for Bruno' })).not.toBeInTheDocument();
  });

  it('offers nothing against the owner', () => {
    renderMenu(MODERATOR, { member: { topPosition: 100, isOwner: true, kind: 'user' } });

    expect(screen.queryByRole('button', { name: 'Options for Bruno' })).not.toBeInTheDocument();
  });

  it.each([
    { item: 'Kick', handler: 'onKick' },
    { item: 'Ban', handler: 'onBan' },
  ] as const)('runs $handler from $item', async ({ item, handler }) => {
    const menu = renderMenu(MODERATOR);

    await menu.open();
    await menu.user.click(screen.getByRole('menuitem', { name: item }));

    expect(menu[handler]).toHaveBeenCalledOnce();
  });

  it('mutes in chat for a duration picked from the submenu', async () => {
    const menu = renderMenu(MODERATOR);

    await menu.open();
    await menu.user.click(screen.getByRole('menuitem', { name: 'Mute in chat' }));
    await menu.user.keyboard('{ArrowRight}{Enter}');

    expect(menu.onMute).toHaveBeenCalledWith('chat', '10m');
  });

  it('offers a separate voice mute only when voice is on', async () => {
    const menu = renderMenu(MODERATOR, { voice: true });

    await menu.open();

    expect(screen.getByRole('menuitem', { name: 'Mute in voice' })).toBeInTheDocument();
  });

  it('disables a role at or above the viewer and assigns one below', async () => {
    const menu = renderMenu(MODERATOR);

    await menu.open();
    await menu.user.click(screen.getByRole('menuitem', { name: 'Roles' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Co-host' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await menu.user.keyboard('{ArrowRight}{Enter}');

    expect(menu.onToggleRole).toHaveBeenCalledWith('r-dj', true);
  });

  it('offers the transfer to the owner, apart from the personal controls', async () => {
    const menu = renderMenu(ONLY_CHATTING, {
      canTransfer: true,
      personalControls: <span role="menuitem">Hide messages</span>,
    });

    await menu.open();

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Transfer ownership',
      'Hide messages',
    ]);
  });

  it('passes axe with the menu open', async () => {
    const { open } = renderMenu(MODERATOR);

    await open();

    expect(await axeViolations()).toEqual([]);
  });
});
