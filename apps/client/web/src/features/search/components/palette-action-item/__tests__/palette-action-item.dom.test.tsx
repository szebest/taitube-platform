import { screen, waitFor, within } from '@testing-library/react';
import { getWatchParty } from '@vp/api-contracts';
import { mockEndpoint, PARTY_ID, partyPreview } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { openPalette } from '#app/features/search/__tests__/search-fixtures';

const actions = () => within(screen.getByRole('group', { name: 'Actions' }));

describe('apps/client/web: PaletteActionItem', () => {
  it('lists the actions under their own heading, each named by its kind', async () => {
    await openPalette();

    expect(actions().getByRole('option', { name: /Switch to dark mode/ })).toHaveTextContent(
      'mode'
    );
    expect(actions().getByRole('option', { name: /Switch to Nocturne/ })).toHaveTextContent(
      'theme'
    );
  });

  it('applies a mode and closes the palette', async () => {
    const { user } = await openPalette();

    await user.click(actions().getByRole('option', { name: /Switch to dark mode/ }));

    expect(decodeURIComponent(document.cookie)).toContain('"mode":"dark"');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies a theme and closes the palette', async () => {
    const { user } = await openPalette();

    await user.click(actions().getByRole('option', { name: /Switch to Nocturne/ }));

    expect(decodeURIComponent(document.cookie)).toContain('"theme":"nocturne"');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers no studio action to a guest', async () => {
    await openPalette();

    expect(actions().queryByRole('option', { name: 'Upload a video' })).not.toBeInTheDocument();
  });

  it('asks a guest who starts a watch party to sign in', async () => {
    const { user } = await openPalette();

    await user.click(actions().getByRole('option', { name: /Start a watch party/ }));

    expect(
      await screen.findByRole('dialog', { name: 'Sign in to watch together' })
    ).toBeInTheDocument();
  });

  it('opens the room a copied party link names, and says when the clipboard holds none', async () => {
    const { user, router } = await openPalette('/', [
      mockEndpoint(getWatchParty, () => HttpResponse.json(partyPreview())),
    ]);

    await navigator.clipboard.writeText('movie night');
    await user.click(actions().getByRole('option', { name: /Join a party from a link/ }));
    expect(await screen.findByText('No party link on your clipboard')).toBeInTheDocument();

    await user.keyboard('/');
    await navigator.clipboard.writeText(`http://localhost:3000/parties/${PARTY_ID}?invite=inv-1`);
    await user.click(await screen.findByRole('option', { name: /Join a party from a link/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/parties/${PARTY_ID}`));
    expect(router.state.location.search).toEqual({ invite: 'inv-1' });
  });
});
