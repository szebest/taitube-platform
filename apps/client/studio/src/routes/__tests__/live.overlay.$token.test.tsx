import { serverRender } from '@vp/web-testing/server';

import { OVERLAY_TOKEN, overlayApi } from '#app/features/live/__tests__/live-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: /live/overlay/$token on the server', () => {
  it('renders the goal overlay for a guest, with the next milestone', async () => {
    const { status, main } = await serverRender(
      getRouter,
      `/live/overlay/${OVERLAY_TOKEN}?widget=goal`,
      { handlers: [overlayApi({ count: 12 })] }
    );

    expect(status).toBe(200);
    expect(main).toContain('12 of 25');
  });
});
