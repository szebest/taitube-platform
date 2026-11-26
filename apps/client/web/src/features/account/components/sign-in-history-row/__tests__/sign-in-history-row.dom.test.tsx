import { screen } from '@testing-library/react';
import { listMySignIns } from '@vp/api-contracts';
import { mockEndpoint, signInRecord } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/web: sign-in history', () => {
  it('lists the sign-ins newest first, a page at a time', async () => {
    const pages: (string | null)[] = [];
    const { user } = await renderRoute(getRouter, '/settings/accounts', {
      handlers: [
        signInBrowser(),
        ...loaderApi(),
        mockEndpoint(listMySignIns, ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
          pages.push(cursor);
          return HttpResponse.json(
            cursor
              ? { items: [signInRecord({ id: crypto.randomUUID(), slot: null })], nextCursor: null }
              : {
                  items: [signInRecord({ slot: 1, userAgent: 'Firefox on Linux' })],
                  nextCursor: 'next',
                }
          );
        }),
      ],
    });

    expect(
      await screen.findByText('Signed in on account 2 On Firefox on Linux')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('On an unknown device')).toBeInTheDocument();
    expect(pages).toEqual([null, 'next']);
  });
});
