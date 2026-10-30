import { screen, waitFor } from '@testing-library/react';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { renderRoute } from '@vp/web-testing/dom';
import type { HttpHandler } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import {
  acceptsSaves,
  holds,
  preferencesView,
  type SentSave,
} from '#app/features/settings/__tests__/preferences-fixtures';
import { getRouter } from '#app/router';

const PAUSED = { ...DEFAULT_PREFERENCES.privacy, historyPaused: true };

function renderPrivacy(handlers: HttpHandler[] = []) {
  const sent: SentSave[] = [];
  const rendered = renderRoute(getRouter, '/settings/privacy', {
    handlers: [
      ...handlers,
      signInBrowser(),
      holds(preferencesView()),
      acceptsSaves(sent, () => preferencesView()),
    ],
  });
  return { rendered, sent };
}

describe('apps/client/web: the privacy rows', () => {
  it.each([
    { row: 'Pause watch and search history', field: 'historyPaused' },
    { row: 'Show my subscriptions', field: 'subscriptionsVisible' },
  ])('saves $row to the account, switched on', async ({ row, field }) => {
    const { rendered, sent } = renderPrivacy();
    const { user } = await rendered;

    await user.click(await screen.findByRole('switch', { name: row }));

    await waitFor(() => expect(sent).toEqual([{ version: 0, privacy: { [field]: true } }]));
  });

  it('saves the default playlist visibility, private until chosen', async () => {
    const { rendered, sent } = renderPrivacy();
    const { user } = await rendered;
    const select = await screen.findByRole('combobox', { name: 'Default playlist visibility' });
    expect(select).toHaveTextContent('Private');

    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Unlisted' }));

    await waitFor(() =>
      expect(sent).toEqual([{ version: 0, privacy: { playlistVisibility: 'unlisted' } }])
    );
  });

  it('shows the pause the account saved', async () => {
    const { rendered } = renderPrivacy([holds(preferencesView({ version: 1, privacy: PAUSED }))]);
    await rendered;

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Pause watch and search history' })).toBeChecked()
    );
  });
});
