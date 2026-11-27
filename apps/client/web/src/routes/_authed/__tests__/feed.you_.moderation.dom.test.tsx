import { screen } from '@testing-library/react';
import { listMyCommentRemovals } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const removals = (asked: string[]) =>
  mockEndpoint(listMyCommentRemovals, ({ request }) => {
    asked.push(new URL(request.url).search);
    return HttpResponse.json({ items: [], nextCursor: null });
  });

describe('apps/client/web: /feed/you/moderation in the browser', () => {
  it('loads the first page of removals before the page renders', async () => {
    const asked: string[] = [];

    await renderRoute(getRouter, '/feed/you/moderation', {
      handlers: [removals(asked), signInBrowser(), ...loaderApi()],
    });

    expect(
      await screen.findByRole('heading', { name: 'Moderation', level: 1 })
    ).toBeInTheDocument();
    expect(asked).toEqual(['?limit=30']);
  });

  it('sends a guest to sign in, and back here', async () => {
    const asked: string[] = [];

    const { router } = await renderRoute(getRouter, '/feed/you/moderation', {
      handlers: [removals(asked), ...loaderApi()],
    });

    expect(router.state.location.href).toBe('/login?redirect=%2Ffeed%2Fyou%2Fmoderation');
    expect(asked).toEqual([]);
  });

  it.each([{ search: '?channel=not-an-id' }])(
    'does not accept $search as a channel',
    async ({ search }) => {
      const { router } = await renderRoute(getRouter, `/feed/you/moderation${search}`, {
        handlers: [removals([]), signInBrowser(), ...loaderApi()],
      });

      expect(router.state.status).toBe('idle');
      expect(
        screen.queryByRole('heading', { name: 'Moderation', level: 1 })
      ).not.toBeInTheDocument();
    }
  );
});
