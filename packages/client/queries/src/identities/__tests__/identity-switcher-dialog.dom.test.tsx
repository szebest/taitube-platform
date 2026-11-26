import { fireEvent, screen } from '@testing-library/react';
import { renderIdentities, type TestAccount } from './render-identities';

const ADA: TestAccount = { slot: 0, name: 'Ada', channels: ['engines', 'notes', 'poems'] };
const BYRON: TestAccount = { slot: 1, name: 'Byron' };
const CLAIRE: TestAccount = { slot: 2, name: 'Claire' };

const pressShortcut = (code: string) =>
  fireEvent.keyDown(window, { key: 'Å', code, altKey: true, shiftKey: true });

describe('@vp/queries: IdentitySwitcherDialog', () => {
  it.each([
    { code: 'KeyA', opens: true },
    { code: 'KeyQ', opens: false },
  ])(
    'opens on Alt+Shift by the key at $code, whatever character it types',
    async ({ code, opens }) => {
      await renderIdentities({ accounts: [ADA, BYRON] });

      pressShortcut(code);

      expect(screen.queryByRole('dialog') !== null).toBe(opens);
    }
  );

  it('searches once there are more than five identities and switches with Enter', async () => {
    const { user, history } = await renderIdentities({ accounts: [ADA, BYRON, CLAIRE] });
    pressShortcut('KeyA');

    await user.type(await screen.findByPlaceholderText('Find an account or channel'), 'claire');
    await user.keyboard('{Enter}');

    await vi.waitFor(() => expect(history.location.pathname).toBe('/u/2/page'));
  });

  it('jumps to the nth row with a digit while the search is empty', async () => {
    const { user, history } = await renderIdentities({ accounts: [ADA, BYRON, CLAIRE] });
    pressShortcut('KeyA');
    await screen.findByRole('option', { name: /ENGINES/ });

    await user.keyboard('2');

    await vi.waitFor(() => expect(history.location.pathname).toBe('/u/0/c/engines/page'));
  });

  it('lists the identities as options, the current one marked, and closes on Escape', async () => {
    const { user } = await renderIdentities({ accounts: [ADA, BYRON] });
    pressShortcut('KeyA');

    const current = (await screen.findAllByRole('option'))[0];
    await user.keyboard('{Escape}');

    expect(current).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
