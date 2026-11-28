import { screen, waitFor, within } from '@testing-library/react';
import {
  createPlaylistShareLink,
  listPlaylistShareLinks,
  revokePlaylistShareLink,
  type ShareLinkView,
} from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { NOW, uuid } from '#app/__tests__/library-fixtures';
import {
  chooseFromMore,
  LAZY,
  LIST,
  renderPlaylist,
} from '#app/features/library/__tests__/render-playlist';
import { LazyShareLinksDialog } from '#app/features/library/components/share-links-dialog/share-links-dialog.lazy';

const TOKEN = 'abcdefghijklmnopqrstuv';

function shareLink(n: number, overrides: Partial<ShareLinkView> = {}): ShareLinkView {
  return {
    id: uuid(8800 + n),
    token: TOKEN,
    label: 'Class',
    expiresAt: null,
    revokedAt: null,
    createdAt: NOW,
    state: 'active',
    stats: { opens: 4, views: 0, watchSeconds: 0 },
    ...overrides,
  };
}

/** The owner's Share links dialog over one active and one revoked link; `writes` collects each change. */
async function openShareLinks() {
  const writes: string[] = [];
  const rendered = await renderPlaylist({}, [
    mockEndpoint(listPlaylistShareLinks, () =>
      HttpResponse.json({
        items: [shareLink(1), shareLink(2, { label: null, state: 'revoked', revokedAt: NOW })],
      })
    ),
    mockEndpoint(createPlaylistShareLink, async ({ request }) => {
      writes.push(`create ${JSON.stringify(await request.json())}`);
      return HttpResponse.json(shareLink(3), { status: 201 });
    }),
    mockEndpoint(revokePlaylistShareLink, ({ params }) => {
      writes.push(`revoke ${String(params.linkId)}`);
      return new HttpResponse(null, { status: 204 });
    }),
  ]);
  await chooseFromMore(rendered.user, 'Share links');
  const dialog = within(await screen.findByRole('dialog', { name: 'Share links' }, LAZY));
  return { ...rendered, dialog, writes };
}

beforeAll(() => LazyShareLinksDialog.preload());

describe('apps/client/web: the playlist share links dialog', () => {
  it('lists each link with its state and opens; only a working one is copied or revoked', async () => {
    const { dialog } = await openShareLinks();

    const list = await dialog.findByRole('list', { name: 'Share links of this playlist' });
    const [active, revoked] = within(list).getAllByRole('listitem');

    expect(active).toHaveTextContent(/Class.*4 opens.*Never expires.*Active/);
    expect(revoked).toHaveTextContent(/No label.*Revoked/);
    expect(within(revoked as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('creates a link with a label and an expiry preset', async () => {
    const { user, dialog, writes } = await openShareLinks();

    await user.type(dialog.getByRole('textbox', { name: 'Label' }), 'Class');
    await user.click(dialog.getByRole('combobox', { name: 'Expires after' }));
    await user.click(await screen.findByRole('option', { name: '24 hours' }));
    await user.click(dialog.getByRole('button', { name: 'Create link' }));

    await waitFor(() => expect(writes).toEqual(['create {"label":"Class","expiresIn":"24h"}']));
  });

  it('copies the playlist address with the token, and revokes', async () => {
    const { user, dialog, writes } = await openShareLinks();

    await user.click(await dialog.findByRole('button', { name: 'Copy the link Class' }));
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/playlist?list=${LIST}&s=${TOKEN}`
    );

    await user.click(dialog.getByRole('button', { name: 'Revoke the link Class' }));
    await waitFor(() => expect(writes).toEqual([`revoke ${uuid(8801)}`]));
  });
});
