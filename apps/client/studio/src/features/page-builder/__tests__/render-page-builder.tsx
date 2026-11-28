import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { type PageState, servePage } from './page-api.fixture';

/** `/customization/page` in the studio over a page API holding `state`, signed in as the channel's owner. */
export async function renderPageBuilder(state: Partial<PageState> = {}) {
  const served = servePage(state);
  const rendered = await renderRoute(getRouter, '/customization/page', {
    handlers: [signInBrowser(), ...served.handlers],
  });
  await screen.findByRole('list', { name: 'Tabs' });
  return { ...rendered, ...served, user: userEvent.setup() };
}
