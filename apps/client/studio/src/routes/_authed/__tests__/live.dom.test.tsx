import { screen, within } from '@testing-library/react';
import { apiServer, mockLiveChatSocket } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { chatTicket, liveApi } from '#app/features/live/__tests__/live-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: /live', () => {
  it('opens the creator stream the API answers with, and marks Live in the studio navigation', async () => {
    apiServer.use(mockLiveChatSocket([], { canModerate: true }).handler);
    await renderRoute(getRouter, '/live', {
      handlers: [signInBrowser(), chatTicket, ...liveApi().handlers],
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Friday build night' })
    ).toBeInTheDocument();
    const navigation = screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement;
    expect(within(navigation).getByRole('link', { name: 'Live' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
