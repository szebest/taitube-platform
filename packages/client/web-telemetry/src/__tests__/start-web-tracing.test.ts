import { apiServer } from '@vp/web-testing';
import { HttpResponse, http } from 'msw';
import { startWebTracing } from '../start-web-tracing';

const API_ORIGIN = 'http://localhost:3000';

const traceparentSeenBy = async (url: string) => {
  let traceparent: string | null = null;
  apiServer.use(
    http.get(url, ({ request }) => {
      traceparent = request.headers.get('traceparent');
      return new HttpResponse(null, { status: 204 });
    })
  );

  await fetch(url);
  return traceparent;
};

describe('startWebTracing', () => {
  beforeAll(() => {
    startWebTracing({
      serviceName: 'taitube-web',
      tracesUrl: 'http://localhost:4318/v1/traces',
      apiOrigin: API_ORIGIN,
    });
  });

  it.each([
    { target: 'the API', url: `${API_ORIGIN}/v1/feed`, propagated: true },
    { target: 'another host', url: 'http://localhost:9000/v1/feed', propagated: false },
    {
      target: 'a port that only starts like the API',
      url: 'http://localhost:30001/',
      propagated: false,
    },
  ])('hands $target a traceparent: $propagated', async ({ url, propagated }) => {
    expect((await traceparentSeenBy(url)) !== null).toBe(propagated);
  });
});
