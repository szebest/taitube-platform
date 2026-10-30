import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: AnalyticsPage', () => {
  it('heads the channel figures with the range control beside the title', async () => {
    serveAnalytics();
    await renderRoute(getRouter, '/analytics?range=7d', { handlers: [signInBrowser()] });

    expect(await screen.findByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Time range' })).toBeInTheDocument();
    expect(await screen.findByText('Views, last 7 days')).toBeInTheDocument();
  });
});
