import { createVitalsQueue, type WebVital } from '../vitals-queue';

const MAX_WEB_VITALS_PER_BATCH = 32;

const LCP: WebVital = { name: 'LCP', value: 1800, route: '/' };
const CLS: WebVital = { name: 'CLS', value: 0.02, route: '/watch/$videoId' };

const createQueue = () => {
  const send = vi.fn();
  return { send, queue: createVitalsQueue('studio', MAX_WEB_VITALS_PER_BATCH, send) };
};

describe('createVitalsQueue', () => {
  it('sends what it holds as one batch for the app, once', () => {
    const { send, queue } = createQueue();

    queue.add(LCP);
    queue.add(CLS);
    queue.flush();
    queue.flush();

    expect(send.mock.calls).toEqual([[{ app: 'studio', vitals: [LCP, CLS] }]]);
  });

  it('sends nothing for an empty queue', () => {
    const { send, queue } = createQueue();

    queue.flush();

    expect(send).not.toHaveBeenCalled();
  });

  it('sends a full batch as soon as it fills, so no batch passes the contract limit', () => {
    const { send, queue } = createQueue();

    for (let added = 0; added <= MAX_WEB_VITALS_PER_BATCH; added++) queue.add(LCP);
    queue.flush();

    expect(send.mock.calls.map(([batch]) => batch.vitals.length)).toEqual([
      MAX_WEB_VITALS_PER_BATCH,
      1,
    ]);
  });
});
