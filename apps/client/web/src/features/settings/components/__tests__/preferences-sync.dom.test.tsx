import { act, screen, waitFor } from '@testing-library/react';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { settleSession } from '@vp/queries';
import { DEFAULT_APPEARANCE, writeCookie } from '@vp/ui';
import { account, apiServer } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import type { HttpHandler } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import {
  acceptsSaves,
  holds,
  preferencesView,
  SAVED_PLAYBACK,
  type SentSave,
} from '../../__tests__/preferences-fixtures';

const renderSettings = (handlers: HttpHandler[]) =>
  renderRoute(getRouter, '/settings', { handlers });

const OLED = { ...DEFAULT_PREFERENCES.appearance, mode: 'oled' } as const;

const OTHER_USER_ID = '0190c3a0-5e1d-7000-8000-00000000b002';

const shownMode = () => document.documentElement.dataset.mode;
const shownTheme = () => document.documentElement.dataset.theme;

describe('apps/client/web: syncing preferences with the account', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it("puts the account's saved appearance over the device's on sign-in", async () => {
    await renderSettings([
      signInBrowser(),
      holds(preferencesView({ version: 2, appearance: OLED })),
    ]);

    await waitFor(() => expect(shownMode()).toBe('oled'));
  });

  it("sends the device's appearance up when the account never saved one, and leaves the section it has", async () => {
    const sent: SentSave[] = [];
    writeCookie('vp.appearance', JSON.stringify({ ...DEFAULT_APPEARANCE, mode: 'light' }), {
      maxAge: 60,
    });

    await renderSettings([
      signInBrowser(),
      holds(preferencesView({ version: 2, playback: SAVED_PLAYBACK })),
      acceptsSaves(sent, () => preferencesView({ version: 3 })),
    ]);

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      version: 2,
      appearance: { ...DEFAULT_PREFERENCES.appearance, mode: 'light' },
    });
  });

  it('sends nothing up for a device that holds only the defaults', async () => {
    const sent: SentSave[] = [];

    await renderSettings([
      signInBrowser(),
      holds(preferencesView()),
      acceptsSaves(sent, () => preferencesView({ version: 1 })),
    ]);

    await screen.findByRole('heading', { name: 'Settings' });
    expect(sent).toEqual([]);
  });

  it('saves an appearance change made anywhere, the header menu here, as the one field that changed', async () => {
    const sent: SentSave[] = [];
    const { user } = await renderSettings([
      signInBrowser(),
      holds(preferencesView({ version: 4, appearance: OLED })),
      acceptsSaves(sent, () => preferencesView({ version: 5 })),
    ]);
    await waitFor(() => expect(shownMode()).toBe('oled'));

    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Nocturne' }));

    await waitFor(() => expect(sent).toEqual([{ version: 4, appearance: { theme: 'nocturne' } }]));
  });

  it('applies a newer document another device saved, without sending anything back', async () => {
    const sent: SentSave[] = [];
    const { queryClient } = await renderSettings([
      signInBrowser(),
      holds(preferencesView({ version: 1, appearance: OLED })),
      acceptsSaves(sent, () => preferencesView()),
    ]);
    await waitFor(() => expect(shownMode()).toBe('oled'));

    act(() =>
      queryClient.setQueryData(
        ['preferences'],
        preferencesView({ version: 2, appearance: { ...OLED, mode: 'light' } })
      )
    );

    await waitFor(() => expect(shownMode()).toBe('light'));
    expect(sent).toEqual([]);
  });

  it("shows only the new account's preferences after a switch", async () => {
    const { router } = await renderSettings([
      signInBrowser(),
      holds(preferencesView({ version: 1, appearance: OLED })),
    ]);
    await waitFor(() => expect(shownMode()).toBe('oled'));

    const other = account();
    apiServer.use(
      signInBrowser({ ...other, user: { ...other.user, id: OTHER_USER_ID } }),
      holds(preferencesView({ version: 9, appearance: { ...OLED, mode: 'light' } }))
    );
    await act(() => settleSession(router));

    await waitFor(() => expect(shownMode()).toBe('light'));
  });

  it("keeps the viewer's change on screen when a newer document arrives before the save is sent", async () => {
    const sent: SentSave[] = [];
    const { user, queryClient } = await renderSettings([
      signInBrowser(),
      holds(preferencesView({ version: 1, appearance: OLED })),
      acceptsSaves(sent, () => preferencesView({ version: 3, appearance: OLED })),
    ]);
    await waitFor(() => expect(shownMode()).toBe('oled'));

    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Nocturne' }));
    act(() =>
      queryClient.setQueryData(['preferences'], preferencesView({ version: 2, appearance: OLED }))
    );

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(shownTheme()).toBe('nocturne');
  });

  it("uploads none of the previous account's settings to the next account's unsaved sections", async () => {
    const sent: SentSave[] = [];
    const { router } = await renderSettings([
      signInBrowser(),
      holds(preferencesView({ version: 1, appearance: OLED })),
      acceptsSaves(sent, () => preferencesView({ version: 10 })),
    ]);
    await waitFor(() => expect(shownMode()).toBe('oled'));

    const other = account();
    apiServer.use(
      signInBrowser({ ...other, user: { ...other.user, id: OTHER_USER_ID } }),
      holds(preferencesView({ version: 9, playback: SAVED_PLAYBACK }))
    );
    await act(() => settleSession(router));

    await waitFor(() => expect(shownMode()).not.toBe('oled'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(sent).toEqual([]);
  });
});
