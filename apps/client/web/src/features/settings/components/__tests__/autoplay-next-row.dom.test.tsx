import { screen, waitFor } from '@testing-library/react';
import { updatePreferences } from '@vp/api-contracts';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import type { HttpHandler } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import {
  acceptsSaves,
  holds,
  preferencesView,
  type SentSave,
} from '../../__tests__/preferences-fixtures';
import { requestDevicePreferences } from '../../device/device-preferences';

const renderPlayback = (handlers: HttpHandler[] = []) =>
  renderRoute(getRouter, '/settings/playback', { handlers });

const autoplay = () => screen.getByRole('switch', { name: 'Autoplay next' });

const SAVED = preferencesView({
  version: 1,
  playback: { ...DEFAULT_PREFERENCES.playback, autoplayNext: false },
});

describe('apps/client/web: the autoplay row', () => {
  it("applies a guest's change at once and keeps it on the device alone", async () => {
    const { user } = await renderPlayback();

    await user.click(autoplay());

    expect(autoplay()).not.toBeChecked();
    expect(requestDevicePreferences().playback.autoplayNext).toBe(false);
  });

  it("saves a signed-in viewer's change to the account, once, and keeps the answer in the cache", async () => {
    const sent: SentSave[] = [];
    const { user, queryClient } = await renderPlayback([
      signInBrowser(),
      holds(preferencesView()),
      acceptsSaves(sent, () => SAVED),
    ]);

    await user.click(autoplay());

    await waitFor(() => expect(sent).toEqual([{ version: 0, playback: { autoplayNext: false } }]));
    await waitFor(() => expect(queryClient.getQueryData(['preferences'])).toEqual(SAVED));
  });

  it('keeps a change the account refused, marks the row, and sends it again on Try again', async () => {
    const sent: SentSave[] = [];
    let refuse = true;
    const save = mockEndpoint(updatePreferences, async ({ request }) => {
      sent.push((await request.json()) as SentSave);
      return refuse ? problemReply(ErrorCodes.INTERNAL) : Response.json(SAVED);
    });
    const { user } = await renderPlayback([signInBrowser(), holds(preferencesView()), save]);

    await user.click(autoplay());

    expect(await screen.findByText('Could not save your settings')).toBeInTheDocument();
    expect(screen.getByText('Not saved to your account')).toBeInTheDocument();
    expect(autoplay()).not.toBeChecked();

    refuse = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.queryByText('Not saved to your account')).toBeNull());
    expect(sent).toHaveLength(2);
  });
});
