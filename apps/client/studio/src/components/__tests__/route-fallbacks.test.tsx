import type { ComponentType } from 'react';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { RouteError, RouteNotFound, RoutePending } from '../route-fallbacks';

function renderFallback(Fallback: ComponentType): Promise<string> {
  return renderPage(<Fallback />, AppProviders);
}

describe('apps/client/studio: route fallbacks', () => {
  it.each([
    { name: 'pending', Fallback: RoutePending, shows: 'Loading</span>' },
    { name: 'error', Fallback: RouteError, shows: 'There was an error while loading the page' },
    { name: 'not-found', Fallback: RouteNotFound, shows: 'This page does not exist.' },
  ])('renders the $name page', async ({ Fallback, shows }) => {
    expect(await renderFallback(Fallback)).toContain(shows);
  });

  it('sends a lost creator back to the studio home', async () => {
    expect(await renderFallback(RouteNotFound)).toContain('href="/"');
  });
});
