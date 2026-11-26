import { sendJsonBeacon } from '@kit/web-telemetry';
import { screen } from '@testing-library/react';
import { getFeed } from '@vp/api-contracts';
import { mockEndpoint, videoSummary } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { RecordingObserver } from '#app/__tests__/recording-observer';
import { getRouter } from '#app/router';

vi.mock(import('@kit/web-telemetry'), async (importOriginal) => ({
  ...(await importOriginal()),
  sendJsonBeacon: vi.fn(),
}));

const EXPERIMENT_ID = '0190c3a0-5e1d-7000-8000-0000000000e2';
const TESTED = videoSummary({
  id: '0190c3a0-5e1d-7000-8000-00000000a011',
  title: 'Tested title',
  experiment: { id: EXPERIMENT_ID, variantId: 'b' },
});
const PLAIN = videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000a012', title: 'Plain title' });

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

const impressionBeacons = () =>
  vi.mocked(sendJsonBeacon).mock.calls.filter(([url]) => url.endsWith('/v1/telemetry/impressions'));

describe('apps/client/web: ImpressionsProvider', () => {
  beforeEach(() => RecordingObserver.install());

  afterEach(() => {
    setVisibility('visible');
  });

  it('beacons the variants the cards in view showed when the page is hidden', async () => {
    await renderRoute(getRouter, '/feed/trending', {
      handlers: [
        mockEndpoint(getFeed, () =>
          HttpResponse.json({ items: [TESTED, PLAIN], nextCursor: null, total: 2 })
        ),
        ...loaderApi(),
      ],
    });
    await screen.findByRole('link', { name: 'Tested title' });

    RecordingObserver.enterView();
    setVisibility('hidden');

    expect(impressionBeacons()).toEqual([
      [
        'http://localhost:3000/v1/telemetry/impressions',
        { items: [{ videoId: TESTED.id, experimentId: EXPERIMENT_ID, variantId: 'b' }] },
      ],
    ]);
  });
});
