import { http, HttpResponse } from 'msw';

import { API_BASE_URL } from '#app/config';
import {
  UnhandledRequestError,
  apiServer,
  endFile,
  endTest,
  listen,
  takeUnhandled,
} from './api-server';

const HEALTH_URL = `${API_BASE_URL}/health`;

function madeBy(test: string): string {
  return `GET ${HEALTH_URL} from "apps/web: apiServer > ${test}"`;
}

describe('apps/web: apiServer', () => {
  it('answers a request no handler matches with a 500 instead of sending it on', async () => {
    const answered = await fetch(HEALTH_URL);

    expect(answered.status).toBe(500);
    expect(takeUnhandled()).toEqual([
      madeBy('answers a request no handler matches with a 500 instead of sending it on'),
    ]);
  });

  it('fails the test that made an unanswered request, naming the request and the test', async () => {
    await fetch(HEALTH_URL);

    expect(endTest).toThrow(
      new UnhandledRequestError([
        madeBy('fails the test that made an unanswered request, naming the request and the test'),
      ])
    );
    expect(takeUnhandled()).toEqual([]);
  });

  it('fails the file on a request that landed after its last test ended', async () => {
    await fetch(HEALTH_URL);

    expect(endFile).toThrow(
      new UnhandledRequestError([
        madeBy('fails the file on a request that landed after its last test ended'),
      ])
    );
    expect(takeUnhandled()).toEqual([]);
    listen();
  });

  it("drops a test's handlers once the test ends", async () => {
    apiServer.use(http.get(HEALTH_URL, () => HttpResponse.json({ status: 'ok' })));
    const before = await fetch(HEALTH_URL);

    endTest();
    const after = await fetch(HEALTH_URL);

    expect([before.status, after.status]).toEqual([200, 500]);
    expect(takeUnhandled()).toEqual([madeBy("drops a test's handlers once the test ends")]);
  });
});
