import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { OVERLAY_TOKEN, overlayApi } from '#app/features/live/__tests__/live-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: studio root', () => {
  it('renders a bare page, such as an OBS overlay, with none of the studio around it', async () => {
    await renderRoute(getRouter, `/live/overlay/${OVERLAY_TOKEN}?widget=goal`, {
      handlers: [overlayApi({ count: 3 })],
    });

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Studio' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Skip to content' })).toBeNull();
  });
});
