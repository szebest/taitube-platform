import type { Metric } from 'web-vitals';
import { startWebVitals } from '../start-web-vitals';

const reporters = vi.hoisted(() => new Map<string, (metric: Metric) => void>());

vi.mock(import('web-vitals'), () => {
  const listen =
    (name: string) =>
    <M extends Metric>(report: (metric: M) => void) => {
      reporters.set(name, report as (metric: Metric) => void);
    };
  return {
    onLCP: listen('LCP'),
    onINP: listen('INP'),
    onCLS: listen('CLS'),
    onFCP: listen('FCP'),
    onTTFB: listen('TTFB'),
  };
});

const VITALS_URL = 'http://localhost:3000/v1/telemetry/vitals';

const startOnPage = () => {
  const page = { route: '/' };
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const window = new EventTarget();
  const sendBeacon = vi.fn((_url: string, _body: string) => true);
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  vi.stubGlobal('navigator', { sendBeacon });

  startWebVitals({ app: 'web', vitalsUrl: VITALS_URL, routeId: () => page.route });

  const report = (name: Metric['name'], value: number) =>
    reporters.get(name)?.({ name, value } as Metric);
  const hide = () => {
    document.visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const batches = () =>
    sendBeacon.mock.calls.map(([url, body]) => ({ url, batch: JSON.parse(body) }));

  return { page, window, report, hide, batches };
};

describe('startWebVitals', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    reporters.clear();
  });

  it('listens for all five vitals', () => {
    startOnPage();

    expect([...reporters.keys()].sort()).toEqual(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);
  });

  it('beacons one batch when the page is hidden, the page-load vitals on the landing route and INP on the route it happened on', () => {
    const { page, report, hide, batches } = startOnPage();

    report('TTFB', 120);
    report('FCP', 700);
    page.route = '/watch/$videoId';
    report('LCP', 1900);
    report('CLS', 0.03);
    report('INP', 88);
    hide();

    expect(batches()).toEqual([
      {
        url: VITALS_URL,
        batch: {
          app: 'web',
          vitals: [
            { name: 'TTFB', value: 120, route: '/' },
            { name: 'FCP', value: 700, route: '/' },
            { name: 'LCP', value: 1900, route: '/' },
            { name: 'CLS', value: 0.03, route: '/' },
            { name: 'INP', value: 88, route: '/watch/$videoId' },
          ],
        },
      },
    ]);
  });

  it('beacons what is left on pagehide, and never resends a batch', () => {
    const { window, report, hide, batches } = startOnPage();

    report('FCP', 700);
    hide();
    report('INP', 64);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));

    expect(batches().map(({ batch }) => batch.vitals)).toEqual([
      [{ name: 'FCP', value: 700, route: '/' }],
      [{ name: 'INP', value: 64, route: '/' }],
    ]);
  });
});
