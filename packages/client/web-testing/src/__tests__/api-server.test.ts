import { HttpResponse, http } from 'msw/http';
import {
  apiServer,
  endFile,
  endTest,
  listen,
  takeUnhandled,
  UnhandledRequestError,
} from '../api-server';

const HEALTH_URL = 'http://localhost:3000/health';

function madeBy(test: string): string {
  return `GET ${HEALTH_URL} from "@vp/web-testing: apiServer > ${test}"`;
}

describe('@vp/web-testing: apiServer', () => {
  it('answers a request no handler matches with a 500 instead of sending it on', async () => {
    const answered = await fetch(HEALTH_URL);

    expect(answered.status).toBe(500);
    expect(takeUnhandled()).toEqual([
      madeBy('answers a request no handler matches with a 500 instead of sending it on'),
    ]);
  });

  it('fails the test that made an unanswered request, naming the request and the test', async () => {
    await fetch(HEALTH_URL);

    await expect(endTest()).rejects.toThrow(
      new UnhandledRequestError([
        madeBy('fails the test that made an unanswered request, naming the request and the test'),
      ])
    );
    expect(takeUnhandled()).toEqual([]);
  });

  it('fails the file on an unanswered request no test has reported yet', async () => {
    await fetch(HEALTH_URL);

    try {
      expect(endFile).toThrow(
        new UnhandledRequestError([
          madeBy('fails the file on an unanswered request no test has reported yet'),
        ])
      );
      expect(takeUnhandled()).toEqual([]);
    } finally {
      listen();
    }
  });

  it('names the contract an unanswered API request needs a mockEndpoint for', async () => {
    await fetch(`${HEALTH_URL.replace('/health', '/v1/videos')}?limit=30`);

    expect(takeUnhandled()).toEqual([
      'GET http://localhost:3000/v1/videos?limit=30 (mock it with mockEndpoint(listVideos, ...)) from "@vp/web-testing: apiServer > names the contract an unanswered API request needs a mockEndpoint for"',
    ]);
  });

  it('waits for a request still in flight before dropping the handlers it is answered by', async () => {
    const order: string[] = [];
    let release = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = false;
    apiServer.use(
      http.get(HEALTH_URL, async () => {
        entered = true;
        await released;
        order.push('answered');
        return HttpResponse.json({ status: 'ok' });
      })
    );
    const late = fetch(HEALTH_URL);
    await vi.waitFor(() => expect(entered).toBe(true));

    const ended = endTest().then(() => order.push('ended'));
    release();
    await ended;

    expect((await late).status).toBe(200);
    expect(order).toEqual(['answered', 'ended']);
  });

  it("drops a test's handlers once the test ends", async () => {
    apiServer.use(http.get(HEALTH_URL, () => HttpResponse.json({ status: 'ok' })));
    const before = await fetch(HEALTH_URL);

    await endTest();
    const after = await fetch(HEALTH_URL);

    expect([before.status, after.status]).toEqual([200, 500]);
    expect(takeUnhandled()).toEqual([madeBy("drops a test's handlers once the test ends")]);
  });
});
