import { screen, within } from '@testing-library/react';
import { listCreatorComments } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { serveLibrary } from '#app/__tests__/library-api.fixture';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership, OTHER_CHANNEL_ID } from '#app/features/team/__tests__/team-api.fixture';

const emptyInbox = mockEndpoint(listCreatorComments, () =>
  HttpResponse.json({ items: [], nextCursor: null })
);

const navLinks = () =>
  within(screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement)
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('apps/client/studio: ChannelSwitcher', () => {
  it('is not offered to a viewer who works on no other channel', async () => {
    await renderTeam();

    expect(screen.queryByRole('button', { name: 'Switch channel' })).toBeNull();
  });

  it("offers the viewer's own channel and each channel they work on, with their role there", async () => {
    const { user } = await renderTeam('/team', { state: { memberships: [membership('editor')] } });

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitemradio', { name: 'The Creator (yours)' })).toBeChecked();
    expect(within(menu).getByRole('menuitemradio', { name: /Other Show/ })).toHaveTextContent(
      'Editor'
    );
  });

  it('moves a moderator to the comment inbox of the channel and shows them nothing else', async () => {
    const { user, router } = await renderTeam('/team', {
      state: { memberships: [membership('moderator')] },
      handlers: [emptyInbox],
    });

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Other Show/ }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/comments'));
    expect(navLinks()).toEqual(['Comments', 'Back to Taitube']);
  });

  it('names the channel on the next channel-scoped call, and goes back to the own one', async () => {
    serveLibrary([{ cursor: null, items: [], next: null }]);
    const { user, router, requests } = await renderTeam('/team', {
      state: { memberships: [membership('manager')] },
      handlers: [emptyInbox],
    });

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Other Show/ }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/videos'));
    await router.navigate({ to: '/team', search: {} });
    await vi.waitFor(() => expect(requests.teamChannels).toEqual([null, OTHER_CHANNEL_ID]));

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'The Creator (yours)' }));
    await router.navigate({ to: '/team', search: {} });

    await vi.waitFor(() => expect(requests.teamChannels).toEqual([null, OTHER_CHANNEL_ID, null]));
  });
});
