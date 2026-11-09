import { MAX_WEB_VITALS_PER_BATCH, recordWebVitals } from '../telemetry';

const LCP = { name: 'LCP', value: 1834.2, route: '/watch/$videoId' };

const batchOf = (overrides: Record<string, unknown> = {}) => ({
  app: 'web',
  vitals: [LCP],
  ...overrides,
});

describe('packages/api-contracts: telemetry', () => {
  it('takes a batch anonymously and answers 204', () => {
    expect(recordWebVitals).toMatchObject({
      method: 'POST',
      path: '/v1/telemetry/vitals',
      anonymous: true,
      status: 204,
    });
  });

  it.each([
    ['a single vital', batchOf()],
    [
      'a CLS score and the root route',
      batchOf({ vitals: [{ name: 'CLS', value: 0.08, route: '__root__' }] }),
    ],
    [
      'the long task time of a page',
      batchOf({ vitals: [{ name: 'LONG_TASKS', value: 428, route: '/' }] }),
    ],
    [
      'a CLS score with the slot that shifted',
      batchOf({
        vitals: [{ name: 'CLS', value: 0.09, route: '/', source: 'app-shell-main' }],
      }),
    ],
    ['an optional param segment', batchOf({ vitals: [{ ...LCP, route: '/c/{-$tab}' }] })],
    ['a full batch', batchOf({ vitals: Array(MAX_WEB_VITALS_PER_BATCH).fill(LCP) })],
  ])('parses %s', (_name, batch) => {
    expect(recordWebVitals.body.parse(batch)).toEqual(batch);
  });

  it.each([
    ['an unknown app', batchOf({ app: 'admin' })],
    ['an empty batch', batchOf({ vitals: [] })],
    ['a batch past the limit', batchOf({ vitals: Array(MAX_WEB_VITALS_PER_BATCH + 1).fill(LCP) })],
    ['an unknown metric', batchOf({ vitals: [{ ...LCP, name: 'FID' }] })],
    ['a negative value', batchOf({ vitals: [{ ...LCP, value: -1 }] })],
    ['an infinite value', batchOf({ vitals: [{ ...LCP, value: Number.POSITIVE_INFINITY }] })],
    ['a value past ten minutes', batchOf({ vitals: [{ ...LCP, value: 600_001 }] })],
    ['a URL in place of a route id', batchOf({ vitals: [{ ...LCP, route: '/watch/1?q=a b' }] })],
    [
      'a shift source that is not a slot name',
      batchOf({ vitals: [{ ...LCP, source: 'div > p.x' }] }),
    ],
    ['an empty route id', batchOf({ vitals: [{ ...LCP, route: '' }] })],
    [
      'a route id past 128 characters',
      batchOf({ vitals: [{ ...LCP, route: `/${'a'.repeat(128)}` }] }),
    ],
  ])('rejects %s', (_name, batch) => {
    expect(recordWebVitals.body.safeParse(batch).success).toBe(false);
  });
});
