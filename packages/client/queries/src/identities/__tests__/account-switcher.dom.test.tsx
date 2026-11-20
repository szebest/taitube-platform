import { screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { renderIdentities, type TestAccount } from './render-identities';

const ADA: TestAccount = { slot: 0, name: 'Ada', channels: ['engines'], teams: ['lab'] };
const BYRON: TestAccount = { slot: 1, name: 'Byron', unread: 3 };

const openMenu = async (user: Awaited<ReturnType<typeof renderIdentities>>['user']) => {
  await user.click(await screen.findByRole('button', { name: 'Account' }));
  return screen.findByRole('menu');
};

describe('@vp/queries: AccountSwitcher', () => {
  it('lists the account, its channels and teams, then the other account with what waits on it, one checked', async () => {
    const { user } = await renderIdentities({ accounts: [ADA, BYRON] });

    const menu = await openMenu(user);

    const rows = within(menu).getAllByRole('menuitemradio');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Ada@ada'),
      expect.stringContaining('ENGINES@engines'),
      expect.stringContaining('LAB'),
      expect.stringContaining('Byron'),
    ]);
    expect(rows[0]).toHaveAttribute('aria-checked', 'true');
    expect(rows[2]).toHaveTextContent('@lab');
    expect(await within(menu).findByText('3 unread')).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it('switches in place: the header changes on the click, then the page, a toast with Undo, an announcement and focus on the heading', async () => {
    const { user, router, history, hold } = await renderIdentities({ accounts: [ADA, BYRON] });
    const entries = history.length;
    const release = hold(1);
    const menu = await openMenu(user);

    await user.click(within(menu).getByRole('menuitemradio', { name: /Byron/ }));

    expect(screen.getByRole('button', { name: 'Account' })).toHaveTextContent('B');
    release();
    expect(
      await screen.findByText('Now browsing as Byron', { selector: '[role="status"]' })
    ).toBeInTheDocument();
    await vi.waitFor(() => expect(document.activeElement).toHaveTextContent('Page'));
    expect(router.state.location.pathname).toBe('/page');
    expect(history.location.pathname).toBe('/u/1/page');
    expect(history.length).toBe(entries);

    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    await vi.waitFor(() => expect(history.location.pathname).toBe('/u/0/page'));
  });

  it.each([
    { key: '{ArrowDown}{ArrowDown}{Enter}', lands: '/u/0/c/engines/page' },
    { key: '4', lands: '/u/1/page' },
  ])('switches from the keyboard with $key', async ({ key, lands }) => {
    const { user, history } = await renderIdentities({ accounts: [ADA, BYRON] });
    await openMenu(user);

    await user.keyboard(key);

    await vi.waitFor(() => expect(history.location.pathname).toBe(lands));
  });

  it('closes on Escape and gives focus back to the account button', async () => {
    const { user } = await renderIdentities({ accounts: [ADA, BYRON] });
    await openMenu(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account' })).toHaveFocus();
  });

  it('prefetches a row it is focused on, once in five seconds', async () => {
    const { user, accountCalls } = await renderIdentities({ accounts: [ADA, BYRON] });
    const menu = await openMenu(user);
    const byron = within(menu).getByRole('menuitemradio', { name: /Byron/ });

    await user.hover(byron);
    await user.hover(within(menu).getByRole('menuitemradio', { name: /Ada/ }));
    await user.hover(byron);

    await vi.waitFor(() => expect(accountCalls.filter((slot) => slot === 1)).toHaveLength(1));
  });

  it('sends an expired account to sign in again for its slot, and back here after', async () => {
    const { user, router } = await renderIdentities({
      accounts: [ADA, { slot: 1, name: 'Byron', expired: true }],
    });
    const menu = await openMenu(user);

    await user.click(within(menu).getByRole('menuitemradio', { name: /Session expired, sign in/ }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toMatchObject({ slot: '1', reason: 'expired' });
  });

  it('lands on the home page when the new identity cannot see the page', async () => {
    const { user, history } = await renderIdentities({ accounts: [ADA, BYRON], url: '/refused' });
    const menu = await openMenu(user);

    await user.click(within(menu).getByRole('menuitemradio', { name: /Byron/ }));

    await vi.waitFor(() => expect(history.location.pathname).toBe('/u/1'));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('points to the searchable list once there are more than five identities', async () => {
    const { user } = await renderIdentities({
      accounts: [{ ...ADA, channels: ['one', 'two', 'three'] }, BYRON],
    });
    const menu = await openMenu(user);

    expect(within(menu).queryAllByRole('menuitemradio')).toHaveLength(0);
    await user.click(within(menu).getByRole('menuitem', { name: /Switch account or channel/ }));

    expect(
      await screen.findByRole('dialog', { name: 'Switch account or channel' })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Find an account or channel')).toBeInTheDocument();
  });

  it('offers sign-out of this account and of all once two are signed in', async () => {
    const { user } = await renderIdentities({ accounts: [ADA, BYRON] });
    const menu = await openMenu(user);

    expect(within(menu).getByRole('menuitem', { name: 'Sign out of this account' })).toBeVisible();
    expect(within(menu).getByRole('menuitem', { name: 'Sign out of all accounts' })).toBeVisible();
  });
});
