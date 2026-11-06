import { screen } from '@testing-library/react';
import { getLiveOverlay } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { OVERLAY_TOKEN, overlayApi } from '#app/features/live/__tests__/live-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: /live/overlay/$token', () => {
  it('asks the API for the overlay of the token in the address, with no sign-in', async () => {
    const asked: string[] = [];
    await renderRoute(getRouter, `/live/overlay/${OVERLAY_TOKEN}?widget=goal`, {
      handlers: [overlayApi({ count: 3 }, asked)],
    });

    expect(asked).toEqual([OVERLAY_TOKEN]);
    expect(screen.getByRole('progressbar', { name: 'Subscriber goal' })).toBeInTheDocument();
  });

  it('is not found for a token the API does not know', async () => {
    await renderRoute(getRouter, '/live/overlay/unknown', {
      handlers: [
        mockEndpoint(getLiveOverlay, () => problemReply(ErrorCodes.LIVE_STREAM_NOT_FOUND)),
      ],
    });

    expect(await screen.findByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });
});
