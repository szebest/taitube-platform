import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { RoutePending } from '../route-fallbacks';

describe('apps/client/studio: route fallbacks', () => {
  it('renders the pending page', async () => {
    expect(await renderPage(<RoutePending />, AppProviders)).toContain('Loading');
  });
});
