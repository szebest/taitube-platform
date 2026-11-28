import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { listWatchPartyControls, putWatchPartyControl } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const TARGET = 'user:0190c3a0-5e1d-7000-8000-000000009103';

const CONTROL = {
  targetKey: TARGET,
  roomId: null,
  voiceMuted: true,
  volume: 100,
  hideMessages: true,
  hideReactions: false,
  hideAvatar: false,
  hideRequests: false,
  blockInvites: false,
  favourite: false,
};

function renderSettings(items: (typeof CONTROL)[]) {
  const saved: unknown[] = [];
  const rendered = renderRoute(getRouter, '/settings/party-controls', {
    handlers: [
      signInBrowser(),
      mockEndpoint(listWatchPartyControls, () => HttpResponse.json({ items })),
      mockEndpoint(putWatchPartyControl, async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ items: [] });
      }),
    ],
  });

  return { rendered, saved };
}

describe('apps/client/web: the party controls page', () => {
  it('says nothing is hidden or muted everywhere', async () => {
    await renderSettings([]).rendered;

    const row = await screen.findByRole('group', { name: 'Everywhere controls' });

    expect(
      await within(row).findByText('Nothing is hidden or muted everywhere')
    ).toBeInTheDocument();
  });

  it('lists an everywhere entry and removes it by saving it empty', async () => {
    const { rendered, saved } = renderSettings([CONTROL]);
    await rendered;

    const row = await screen.findByRole('group', { name: 'Everywhere controls' });
    await userEvent.click(
      await within(row).findByRole('button', { name: `Remove the controls for ${TARGET}` })
    );

    await vi.waitFor(() =>
      expect(saved).toEqual([
        expect.objectContaining({
          targetKey: TARGET,
          roomId: null,
          hideMessages: false,
          voiceMuted: false,
          volume: 100,
        }),
      ])
    );
  });
});
