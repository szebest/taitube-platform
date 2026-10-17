import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { startWebTracing } from '../start-web-tracing';
import { startWebVitals } from '../start-web-vitals';
import { useWebTelemetry } from '../use-web-telemetry';

vi.mock(import('../start-web-vitals'), () => ({ startWebVitals: vi.fn() }));
vi.mock(import('../start-web-tracing'), () => ({ startWebTracing: vi.fn() }));

const TRACES_URL = 'http://localhost:4318/v1/traces';

interface TelemetryOptions {
  inServer?: boolean;
  tracesUrl?: string | undefined;
}

const renderTelemetry = async ({ inServer = false, ...overrides }: TelemetryOptions = {}) => {
  const { tracesUrl } = { tracesUrl: TRACES_URL, ...overrides };

  function Root() {
    useWebTelemetry({ app: 'studio', apiBaseUrl: 'http://localhost:3000', tracesUrl });

    return <Outlet />;
  }

  const rootRoute = createRootRoute({ component: Root });
  const watchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/watch/$videoId',
    component: () => <p>watching</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([watchRoute]),
    history: createMemoryHistory({ initialEntries: ['/watch/0190c3a0'] }),
  });
  await router.load();

  const app = <RouterProvider router={router} />;
  return inServer ? renderToString(app) : render(app).container.innerHTML;
};

describe('useWebTelemetry', () => {
  it('starts nothing in the server render', async () => {
    const html = await renderTelemetry({ inServer: true });

    expect(html).toContain('watching');
    expect(startWebVitals).not.toHaveBeenCalled();
    expect(startWebTracing).not.toHaveBeenCalled();
  });

  it('starts the beacon and the traces once the app is mounted, tagged with the app', async () => {
    await renderTelemetry();

    await vi.waitFor(() => expect(startWebTracing).toHaveBeenCalled());
    expect(startWebTracing).toHaveBeenCalledExactlyOnceWith({
      serviceName: 'taitube-studio',
      tracesUrl: TRACES_URL,
      apiOrigin: 'http://localhost:3000',
    });
    expect(startWebVitals).toHaveBeenCalledExactlyOnceWith({
      app: 'studio',
      vitalsUrl: 'http://localhost:3000/v1/telemetry/vitals',
      routeId: expect.any(Function),
    });
    expect(vi.mocked(startWebVitals).mock.lastCall?.[0].routeId()).toBe('/watch/$videoId');
  });

  it('starts the beacon and loads no tracer when the build names no collector', async () => {
    await renderTelemetry({ tracesUrl: undefined });

    await vi.waitFor(() => expect(startWebVitals).toHaveBeenCalledOnce());
    expect(startWebTracing).not.toHaveBeenCalled();
  });
});
