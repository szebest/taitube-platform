import type { WebVitalsBatch } from '@vp/api-contracts';
import { sendJsonBeacon } from '../send-json-beacon';

const URL = 'http://localhost:3000/v1/telemetry/vitals';
const BATCH: WebVitalsBatch = { app: 'web', vitals: [{ name: 'INP', value: 96, route: '/' }] };

const send = (beaconAccepted: boolean) => {
  const sendBeacon = vi.fn(() => beaconAccepted);
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('navigator', { sendBeacon });
  vi.stubGlobal('fetch', fetch);

  sendJsonBeacon(URL, BATCH);

  return { sendBeacon, fetch };
};

describe('sendJsonBeacon', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('beacons the payload as a JSON string, which goes out as text/plain', () => {
    const { sendBeacon, fetch } = send(true);

    expect(sendBeacon).toHaveBeenCalledWith(URL, JSON.stringify(BATCH));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts with keepalive when the browser refuses the beacon', () => {
    const { fetch } = send(false);

    expect(fetch).toHaveBeenCalledWith(URL, {
      method: 'POST',
      body: JSON.stringify(BATCH),
      keepalive: true,
    });
  });
});
