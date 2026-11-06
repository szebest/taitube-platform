import { screen, waitFor } from '@testing-library/react';
import { listMySubscriptions } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { signInBrowser } from '#app/__tests__/providers';
import {
  acceptsSaves,
  holds,
  preferencesView,
  type SentSave,
} from '#app/features/account/__tests__/preferences-fixtures';
import { getRouter } from '#app/router';

describe('apps/client/web: the notification rows', () => {
  it.each([
    { row: 'Uploads from subscriptions', field: 'subscriptionUploads' },
    { row: 'Replies and mentions', field: 'repliesAndMentions' },
    { row: 'Processing finished', field: 'processingFinished' },
  ])('starts $row on and saves it switched off', async ({ row, field }) => {
    const sent: SentSave[] = [];
    const { user } = await renderRoute(getRouter, '/settings/notifications', {
      handlers: [
        signInBrowser(),
        holds(preferencesView()),
        acceptsSaves(sent, () => preferencesView()),
        mockEndpoint(listMySubscriptions, () => HttpResponse.json({ items: [], nextCursor: null })),
      ],
    });
    const toggle = await screen.findByRole('switch', { name: row });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    await waitFor(() => expect(sent).toEqual([{ version: 0, notifications: { [field]: false } }]));
  });
});
