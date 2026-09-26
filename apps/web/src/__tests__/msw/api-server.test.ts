import { http, HttpResponse } from 'msw';

import { API_BASE_URL } from '#app/config';
import { UnhandledRequestError, apiServer, endTest, takeUnhandled } from './api-server';

const HEALTH_URL = `${API_BASE_URL}/health`;

describe('apps/web: apiServer', () => {
  it('answers a request no handler matches with a 500 instead of sending it on', async () => {
    const answered = await fetch(HEALTH_URL);

    expect(answered.status).toBe(500);
    expect(takeUnhandled()).toEqual([`GET ${HEALTH_URL}`]);
  });

  it('fails the test that made an unanswered request, naming the request', async () => {
    await fetch(HEALTH_URL);

    expect(endTest).toThrow(new UnhandledRequestError([`GET ${HEALTH_URL}`]));
    expect(takeUnhandled()).toEqual([]);
  });

  it("drops a test's handlers once the test ends", async () => {
    apiServer.use(http.get(HEALTH_URL, () => HttpResponse.json({ status: 'ok' })));
    const before = await fetch(HEALTH_URL);

    endTest();
    const after = await fetch(HEALTH_URL);

    expect([before.status, after.status]).toEqual([200, 500]);
    expect(takeUnhandled()).toEqual([`GET ${HEALTH_URL}`]);
  });
});
