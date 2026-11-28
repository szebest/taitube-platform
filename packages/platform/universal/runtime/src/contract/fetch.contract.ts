import type { Fetch } from '../tokens';

export interface FetchSubject {
  readonly fetch: Fetch;
  serve(body: string, status?: number): void;
  requests(): readonly { input: RequestInfo | URL; init: RequestInit | undefined }[];
}

export type MakeFetchSubject = () => FetchSubject;

export function describeFetchContract(makeSubject: MakeFetchSubject): void {
  describe('Fetch contract', () => {
    it.each([
      { body: 'pong', status: 200 },
      { body: 'gone', status: 404 },
    ])('resolves the response the transport answered, status $status', async ({ body, status }) => {
      const subject = makeSubject();
      subject.serve(body, status);

      const response = await subject.fetch('http://localhost/ping');

      expect([response.status, await response.text()]).toEqual([status, body]);
    });

    it('hands the input and the init to the transport as they were given', async () => {
      const subject = makeSubject();
      subject.serve('ok');
      const init = { method: 'POST', body: 'payload' };

      await subject.fetch('http://localhost/submit', init);

      expect(subject.requests()).toEqual([{ input: 'http://localhost/submit', init }]);
    });

    it('answers a call without an init as a call without an init', async () => {
      const subject = makeSubject();
      subject.serve('ok');

      await subject.fetch('http://localhost/ping');

      expect(subject.requests()[0]?.init).toBeUndefined();
    });
  });
}
