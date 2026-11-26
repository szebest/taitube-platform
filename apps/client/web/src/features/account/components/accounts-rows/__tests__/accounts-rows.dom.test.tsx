import { screen, within } from '@testing-library/react';
import { listMyIdentities, listMySignIns, promoteMyChannel } from '@vp/api-contracts';
import { account, identities, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const SECOND = {
  id: '0190c3a0-5e1d-7000-8000-0000000000c2',
  handle: 'engines',
  displayName: 'Engines',
  avatarUrl: null,
  isPrimary: false,
};

const accountsCookie = () =>
  JSON.parse(
    decodeURIComponent(
      document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('vp.accounts='))
        ?.slice('vp.accounts='.length) ?? '{}'
    )
  );

/** The browser's slot list, which a sign-in made since accounts had slots always writes. */
function listSlot() {
  const { user, channel } = account();
  const row = {
    slot: 0,
    userId: user.id,
    label: channel.displayName,
    avatarUrl: null,
    channel: null,
    expired: false,
  };
  // oxlint-disable-next-line unicorn/no-document-cookie -- the slot list scripts may read.
  document.cookie = `vp.accounts=${encodeURIComponent(JSON.stringify({ defaultSlot: 0, slots: [row] }))}; path=/`;
}

async function renderAccounts() {
  const promoted: string[] = [];
  const { channels } = account();
  listSlot();
  const rendered = await renderRoute(getRouter, '/settings/accounts', {
    handlers: [
      signInBrowser(),
      ...loaderApi(),
      mockEndpoint(listMyIdentities, () =>
        HttpResponse.json(
          identities({
            owned: [...channels.map((owned) => ({ ...owned, isPrimary: true })), SECOND],
          })
        )
      ),
      mockEndpoint(listMySignIns, () => HttpResponse.json({ items: [], nextCursor: null })),
      mockEndpoint(promoteMyChannel, ({ params }) => {
        promoted.push(String(params.id));
        return HttpResponse.json({ ...SECOND, isPrimary: true });
      }),
    ],
  });
  return { ...rendered, promoted };
}

describe('apps/client/web: the accounts settings rows', () => {
  it('pins an identity to the top of the switcher', async () => {
    const { user } = await renderAccounts();

    await user.click(await screen.findByRole('button', { name: 'Pin Engines' }));

    await vi.waitFor(() => expect(accountsCookie().pinned).toEqual(['0.engines']));
    expect(await screen.findByRole('button', { name: 'Unpin Engines' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('gives an identity the ring colour picked for it', async () => {
    const { user } = await renderAccounts();
    const engines = await screen.findByRole('group', { name: 'Ring colour for Engines' });

    await user.click(within(engines).getByRole('button', { name: 'Colour 4' }));

    await vi.waitFor(() => expect(accountsCookie().accents).toEqual({ '0.engines': 4 }));
  });

  it('makes another owned channel the primary one', async () => {
    const { user, promoted } = await renderAccounts();

    await user.click(await screen.findByRole('button', { name: 'Make primary' }));

    expect(await screen.findByText('Engines is your primary channel now')).toBeInTheDocument();
    expect(promoted).toEqual([SECOND.id]);
  });

  it('opens the new channel form', async () => {
    const { user } = await renderAccounts();

    await user.click(await screen.findByRole('button', { name: 'Create channel' }));

    expect(await screen.findByRole('dialog', { name: 'Create a channel' })).toBeInTheDocument();
  });
});
